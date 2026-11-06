/* ---------- Найз, зурвас (supabase/migrations/0012_social.sql-ийн функцүүд) ----------
   Бусдын мэдээллийг зөвхөн нууцлал, блокийг шалгадаг RPC-ээр уншина. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { translator, type Translate } from './i18n';
import type { Audience, MoodId } from './types';

export type Relation = 'self' | 'friend' | 'outgoing' | 'incoming' | 'none';
export type Person = { id: string; name: string; handle: string | null; avatar: string | null };
/** archived: архивласан, шинэ зурвас ирэхэд false болно. mood_hidden: би энэ хүнээс сэтгэл санаагаа нуусан */
export type FriendRow = Person & { mood: MoodId | null; mood_date: string | null; last_body: string | null; last_at: string | null; last_mine: boolean | null; unread: number; archived: boolean; mood_hidden: boolean; favorite: boolean; active_at: string | null; note_text: string | null; note_mood: MoodId | null; note_at: string | null };
export type ChatRow = Person & { last_body: string | null; last_at: string | null; last_mine: boolean | null; unread: number; archived: boolean };
export type RequestRow = Person & { direction: 'incoming' | 'outgoing'; created_at: string };
export type SearchRow = Person & { relation: Relation };
export type UserCard = Person & {
  relation: Relation; mood: MoodId | null; mood_date: string | null;
  friends_count: number | null; friends_visible: boolean; can_message: boolean; is_private: boolean;
  mood_hidden: boolean; archived: boolean;
};
export type Message = { id: number; sender: string; recipient: string; body: string; created_at: string; read_at: string | null };
export type SocialCounts = { friends: number; incoming: number; unread: number; blocked: number };

export const AUDIENCE: [Audience, string][] = [['everyone', 'Бүгд'], ['friends', 'Зөвхөн найзууд'], ['nobody', 'Хэн ч биш']];

/** Хэрэглэгчийн богино ID (хайхад хэрэглэнэ) */
export const shortId = (id: string) => id.slice(0, 8);
export const HANDLE_RE = /^[a-z0-9_.]{3,20}$/;
/** Оруулсан нэрийг @handle болгож цэвэрлэнэ */
export const cleanHandle = (s: string) => s.trim().toLowerCase().replace(/^@/, '');

const ERR: Record<string, string> = {
  blocked: 'Энэ хэрэглэгчтэй харилцах боломжгүй',
  'not allowed': 'Энэ хүн зөвхөн найзаасаа зурвас хүлээж авдаг',
  'not found': 'Хэрэглэгч олдсонгүй',
};
/** RPC алдааг хэрэглэгчид ойлгомжтой текст болгоно */
export const socialError = (e: { message?: string } | null | undefined) =>
  Object.entries(ERR).find(([k]) => e?.message?.includes(k))?.[1] ?? 'Алдаа гарлаа. Дахин оролдоно уу.';

type Db = SupabaseClient;
const rows = async <T,>(p: PromiseLike<{ data: unknown; error: unknown }>) => {
  const { data, error } = await p;
  if (error) throw error;
  return (data ?? []) as T[];
};

/** Найзын жагсаалтын шүүлтүүр: нэр/@нэрээр, мөн бүгд / уншаагүй / архив */
export type ChatFilter = 'all' | 'unread' | 'archived';
export function filterChats<T extends Person & { unread: number; archived: boolean }>(list: T[], q: string, f: ChatFilter) {
  const t = q.trim().toLowerCase().replace(/^@/, '');
  return list.filter(x => (f === 'archived' ? x.archived : !x.archived) && (f !== 'unread' || x.unread > 0)
    && (!t || x.name.toLowerCase().includes(t) || (x.handle ?? '').includes(t)));
}

export const social = {
  counts: async (db: Db) => (await rows<SocialCounts>(db.rpc('social_counts')))[0] ?? { friends: 0, incoming: 0, unread: 0, blocked: 0 },
  friends: (db: Db) => rows<FriendRow>(db.rpc('my_friends')),
  otherChats: (db: Db) => rows<ChatRow>(db.rpc('other_chats')),
  requests: (db: Db) => rows<RequestRow>(db.rpc('friend_requests')),
  blocked: (db: Db) => rows<Person>(db.rpc('blocked_users')),
  // «#c4261898» гэж ID-аа бичвэл ч олно
  search: (db: Db, q: string) => rows<SearchRow>(db.rpc('search_users', { q: q.trim().replace(/^#/, '') })),
  card: async (db: Db, target: string) => (await rows<UserCard>(db.rpc('user_card', { target })))[0] ?? null,
  userFriends: (db: Db, target: string) => rows<Person>(db.rpc('user_friends', { target })),
  messages: (db: Db, me: string, other: string) => rows<Message>(db.from('messages').select('id,sender,recipient,body,created_at,read_at')
    .or(`and(sender.eq.${me},recipient.eq.${other}),and(sender.eq.${other},recipient.eq.${me})`).order('created_at').limit(200)),
};

/** Найзын хүсэлт илгээсэн/зөвшөөрсний дараа нөгөө хүнд push илгээнэ. Амжилтгүй болсон ч үйлдэлд нөлөөлөхгүй. */
export const notifyFriend = (target: string, event: 'request' | 'accepted') =>
  void fetch('/api/push/friend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target, event }) }).catch(() => {});

/** Сүүлд идэвхтэй байснаас 2 минут болоогүй бол «онлайн» */
/** Бодол (note) 24 цаг харагдана */
export const NOTE_MAX = 60;
export const noteLive = (at: string | null, now = Date.now()) => !!at && now - new Date(at).getTime() < 24 * 3600_000;

export const isActive =(at: string | null, now = Date.now()) => !!at && now - new Date(at).getTime() < 2 * 60_000;

/** Messenger маягийн богино хугацаа: «одоо», «5 мин», «3 цаг», «2 өдөр», «7 долоо хоног» */
export function shortAgo(at: string | null, now = Date.now(), tr: Translate = translator('mn')) {
  if (!at) return '';
  const m = Math.max(0, Math.round((now - new Date(at).getTime()) / 60_000));
  return m < 1 ? tr('одоо') : m < 60 ? tr('{0} мин', m) : m < 1440 ? tr('{0} цаг', Math.round(m / 60)) : m < 10080 ? tr('{0} өдөр', Math.round(m / 1440)) : tr('{0} долоо хоног', Math.round(m / 10080));
}

/** Сүүлийн mood-ийн огноог «өнөөдөр / өчигдөр / 3 өдрийн өмнө» болгоно */
export function moodAgo(date: string | null, today: string, tr: Translate = translator('mn')) {
  if (!date) return '';
  const d = Math.round((new Date(today + 'T12:00').getTime() - new Date(date + 'T12:00').getTime()) / 864e5);
  return d <= 0 ? tr('өнөөдөр') : d === 1 ? tr('өчигдөр') : tr('{0} өдрийн өмнө', d);
}
