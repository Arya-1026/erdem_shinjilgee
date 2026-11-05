'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ActionMenu, type MenuItem } from '@/components/action-menu';
import { PersonAvatar } from '@/components/person-avatar';
import { useApp } from '@/components/providers/app-provider';
import { Segmented } from '@/components/segmented';
import { Button } from '@/components/ui/button';
import { moodById } from '@/lib/data';
import { today } from '@/lib/date';
import { filterChats, moodAgo, social, socialError, type ChatFilter, type ChatRow, type FriendRow, type Person, type RequestRow, type SearchRow } from '@/lib/social';
import { cn } from '@/lib/utils';

type Tab = 'friends' | 'requests' | 'search' | 'blocked';
const TABS: Tab[] = ['friends', 'requests', 'search', 'blocked'];

const FIELD = 'min-h-11 w-full min-w-0 rounded-xl border-[1.5px] bg-background px-3 focus:border-primary focus:outline-none';
const preview = (s: string | null) => (s && s.length > 48 ? s.slice(0, 48) + '…' : s);

export default function FriendsPage() {
  const { supabase } = useApp();
  // Профайлаас /friends?tab=blocked гэх мэтээр шууд тухайн таб руу орно
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>(() => TABS.find(t => t === params.get('tab')) ?? 'friends');
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<ChatFilter>('all');
  const [friends, setFriends] = useState<FriendRow[] | null>(null);
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [blocked, setBlocked] = useState<Person[]>([]);

  const load = useCallback(async () => {
    try {
      const [f, c, r, b] = await Promise.all([social.friends(supabase), social.otherChats(supabase), social.requests(supabase), social.blocked(supabase)]);
      setFriends(f); setChats(c); setRequests(r); setBlocked(b);
    } catch (e) {
      setFriends([]);
      toast.error(socialError(e as Error));
    }
  }, [supabase]);
  useEffect(() => {
    // Шинэ зурвас, хүсэлт ирэхэд жагсаалт шинэчлэгдэнэ
    const t = setTimeout(() => void load(), 0);
    const id = setInterval(() => { if (!document.hidden) void load(); }, 15_000);
    return () => { clearTimeout(t); clearInterval(id); };
  }, [load]);

  const incoming = requests.filter(r => r.direction === 'incoming');
  const act = async (p: PromiseLike<{ error: unknown }>, ok: string) => {
    const { error } = await p;
    if (error) return void toast.error(socialError(error as Error));
    toast(ok);
    void load();
  };

  const shown = filterChats(friends ?? [], q, filter), others = filterChats(chats, q, filter);
  const archivedN = (friends ?? []).filter(x => x.archived).length + chats.filter(x => x.archived).length;
  // Яриа бүрийн ⋯ цэс (Messenger-ийн адил)
  const menu = (p: Person & { archived: boolean; mood_hidden?: boolean }, isFriend: boolean): MenuItem[] => [
    { label: p.archived ? '📤 Архиваас гаргах' : '🗄️ Архивлах',
      onSelect: () => void act(supabase.rpc('set_chat_archived', { partner: p.id, archived: !p.archived }), p.archived ? 'Архиваас гаргалаа' : 'Архивлалаа. Шинэ зурвас ирвэл дахин гарч ирнэ.') },
    isFriend && { label: p.mood_hidden ? '🙂 Сэтгэл санаагаа харуулах' : '🙈 Сэтгэл санаагаа нуух',
      onSelect: () => void act(supabase.rpc('set_mood_hidden', { target: p.id, hidden: !p.mood_hidden }), p.mood_hidden ? `${p.name} таны сэтгэл санааг харна` : `${p.name}-аас сэтгэл санаагаа нууллаа`) },
    { label: '🗑️ Ярианы түүх устгах', danger: true,
      onSelect: () => { if (confirm('Энэ ярианы түүхийг өөрөөсөө устгах уу? Нөгөө хүнд хэвээр үлдэнэ.')) void act(supabase.rpc('delete_chat', { partner: p.id }), 'Ярианы түүх устлаа'); } },
    isFriend && { label: '👋 Найзаас хасах', danger: true,
      onSelect: () => { if (confirm(`${p.name}-г найзаас хасах уу?`)) void act(supabase.rpc('remove_friend', { target: p.id }), 'Найзаас хаслаа'); } },
    { label: '🚫 Блоклох', danger: true,
      onSelect: () => { if (confirm(`${p.name}-г блоклох уу? Тэр танд бичих, таныг хайж олох боломжгүй болно.`)) void act(supabase.rpc('block_user', { target: p.id }), 'Блоклолоо'); } },
  ];

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-3.5">
      <Segmented full label="Найзын хэсэг" value={tab} onChange={setTab} options={[
        ['friends', `👥 Найзууд${friends?.length ? ` ${friends.length}` : ''}`],
        ['requests', <span key="r">📨 Хүсэлт{incoming.length > 0 && <b className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{incoming.length}</b>}</span>],
        ['search', '🔍 Хайх'],
        ['blocked', '🚫 Блок'],
      ]} />

      {tab === 'friends' && (
        <section className="card-x">
          <div className="mb-2 flex flex-col gap-2">
            <input type="search" className={FIELD} placeholder="🔍 Найзаа нэрээр шүүх" aria-label="Найз шүүх" value={q} onChange={e => setQ(e.target.value)} />
            <Segmented label="Шүүлтүүр" value={filter} onChange={setFilter}
              options={[['all', 'Бүгд'], ['unread', 'Уншаагүй'], ['archived', `🗄️ Архив${archivedN ? ` ${archivedN}` : ''}`]]} />
          </div>
          {friends === null ? <p className="py-6 text-center text-sm text-muted-foreground">Ачаалж байна…</p>
            : !friends.length && !chats.length ? (
              <div className="py-6 text-center">
                <p className="text-sm text-muted-foreground">Одоогоор найз алга.</p>
                <Button size="xl" variant="secondary" className="mt-3" onClick={() => setTab('search')}>🔍 Найз хайх</Button>
              </div>
            ) : !shown.length && !others.length ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{filter === 'archived' ? 'Архивласан яриа алга.' : filter === 'unread' ? 'Уншаагүй зурвас алга 🎉' : 'Олдсонгүй.'}</p>
            ) : shown.map(f => <FriendLine key={f.id} f={f} menu={menu(f, true)} />)}
          {others.length > 0 && (
            <>
              <h3 className="mt-4 mb-1 text-sm font-semibold text-muted-foreground">Бусад яриа</h3>
              {others.map(c => <FriendLine key={c.id} f={{ ...c, mood: null, mood_date: null, mood_hidden: false }} menu={menu(c, false)} />)}
            </>
          )}
        </section>
      )}

      {tab === 'requests' && (
        <section className="card-x">
          {!requests.length && <p className="py-6 text-center text-sm text-muted-foreground">Хүсэлт алга.</p>}
          {incoming.length > 0 && <h3 className="mb-1 text-sm font-semibold text-muted-foreground">Танд ирсэн</h3>}
          {incoming.map(r => (
            <PersonLine key={r.id} p={r}>
              <Button size="sm" className="h-9 px-3" onClick={() => void act(supabase.rpc('respond_friend_request', { from_user: r.id, accept: true }), `${r.name} найз боллоо 🎉`)}>Зөвшөөрөх</Button>
              <Button size="sm" className="h-9 px-3" variant="outline" onClick={() => void act(supabase.rpc('respond_friend_request', { from_user: r.id, accept: false }), 'Хүсэлтийг татгалзлаа')}>Татгалзах</Button>
            </PersonLine>
          ))}
          {requests.some(r => r.direction === 'outgoing') && <h3 className="mt-3 mb-1 text-sm font-semibold text-muted-foreground">Таны илгээсэн</h3>}
          {requests.filter(r => r.direction === 'outgoing').map(r => (
            <PersonLine key={r.id} p={r} sub="Хариу хүлээж байна">
              <Button size="sm" className="h-9 px-3" variant="outline" onClick={() => void act(supabase.rpc('remove_friend', { target: r.id }), 'Хүсэлтээ цуцаллаа')}>Цуцлах</Button>
            </PersonLine>
          ))}
        </section>
      )}

      {tab === 'search' && <Search onChange={load} />}

      {tab === 'blocked' && (
        <section className="card-x">
          <p className="mb-2 text-sm text-muted-foreground">Блоклосон хүн таныг хайж олох, хүсэлт, зурвас илгээх, таны сэтгэл санааг харах боломжгүй.</p>
          {!blocked.length && <p className="py-4 text-center text-sm text-muted-foreground">Блоклосон хүн алга.</p>}
          {blocked.map(b => (
            <PersonLine key={b.id} p={b}>
              <Button size="sm" className="h-9 px-3" variant="outline" onClick={() => void act(supabase.rpc('unblock_user', { target: b.id }), 'Блокоос гаргалаа')}>Блок цуцлах</Button>
            </PersonLine>
          ))}
        </section>
      )}
    </div>
  );
}

/* Найзын мөр: сүүлийн mood, сүүлийн зурвас, уншаагүй тоо. Дарвал профайл + чат руу. */
function FriendLine({ f, menu }: { f: FriendRow; menu: MenuItem[] }) {
  const [now] = useState(today);
  return (
    <div className="flex items-center gap-1 border-b last:border-0">
      <Link href={`/friends/${f.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-2.5">
        <PersonAvatar name={f.name} avatar={f.avatar} mood={f.mood} className="size-12 text-lg" />
        <div className="min-w-0 flex-1">
          <b className="block truncate">{f.name} {f.handle && <span className="font-normal text-muted-foreground">@{f.handle}</span>}{f.mood_hidden && <span className="ml-1 text-xs" title="Та энэ хүнээс сэтгэл санаагаа нуусан">🙈</span>}</b>
          <span className={cn('block truncate text-sm', f.unread ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
            {f.last_body ? `${f.last_mine ? 'Та: ' : ''}${preview(f.last_body)}` : f.mood ? `${moodById(f.mood).emoji} ${moodById(f.mood).label} · ${moodAgo(f.mood_date, now)}` : 'Зурвас бичих'}
          </span>
        </div>
        {f.unread > 0 && <span className="grid min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground">{f.unread}</span>}
      </Link>
      <ActionMenu items={menu} label={`${f.name}: үйлдэл`} />
    </div>
  );
}

function PersonLine({ p, sub, children }: { p: Person; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b py-2.5 last:border-0">
      <Link href={`/friends/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <PersonAvatar name={p.name} avatar={p.avatar ?? null} className="size-11" />
        <span className="min-w-0">
          <b className="block truncate">{p.name}</b>
          <span className="block truncate text-sm text-muted-foreground">{sub ?? (p.handle ? `@${p.handle}` : '')}</span>
        </span>
      </Link>
      <div className="flex flex-none gap-1.5">{children}</div>
    </div>
  );
}

const REL_LABEL = { friend: '✓ Найз', outgoing: 'Хүсэлт илгээсэн', incoming: 'Танд хүсэлт илгээсэн', self: 'Та', none: '' } as const;

/* Нэр, @handle эсвэл ID-аар хайх. Enter дарахад хайна. */
function Search({ onChange }: { onChange: () => void }) {
  const { supabase, profile } = useApp();
  const [q, setQ] = useState('');
  const [res, setRes] = useState<SearchRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    if (q.trim().length < 2) return void toast('Хамгийн багадаа 2 тэмдэгт бичнэ үү');
    setBusy(true);
    try { setRes(await social.search(supabase, q)); } catch (err) { toast.error(socialError(err as Error)); } finally { setBusy(false); }
  }

  async function add(p: SearchRow) {
    const { data, error } = await supabase.rpc('send_friend_request', { target: p.id });
    if (error) return void toast.error(socialError(error));
    toast(data === 'friend' ? `${p.name} найз боллоо 🎉` : 'Найзын хүсэлт илгээлээ 📨');
    setRes(r => r?.map(x => (x.id === p.id ? { ...x, relation: data as SearchRow['relation'] } : x)) ?? null);
    onChange();
  }

  return (
    <section className="card-x">
      <form className="flex gap-2" onSubmit={e => void run(e)}>
        <input type="search" className={FIELD} placeholder="Нэр, @нэр эсвэл ID" aria-label="Хүн хайх" value={q} maxLength={60} onChange={e => setQ(e.target.value)} />
        <Button type="submit" size="xl" variant="secondary" className="h-11 flex-none" disabled={busy}>{busy ? '…' : 'Хайх'}</Button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">
        Таны нэр: {profile.handle ? <b>@{profile.handle}</b> : <Link href="/profile#social" className="font-semibold text-primary">@нэр тохируулах</Link>} · ID: <b>{profile.id.slice(0, 8)}</b>
      </p>
      {res && !res.length && <p className="py-4 text-center text-sm text-muted-foreground">Хүн олдсонгүй. Нууц профайлтай хүнийг яг @нэр эсвэл ID-аар нь хайна.</p>}
      {res?.map(p => (
        <PersonLine key={p.id} p={p}>
          {p.relation === 'none' ? <Button size="sm" className="h-9 px-3" onClick={() => void add(p)}>＋ Найз нэмэх</Button>
            : p.relation === 'incoming' ? <Button size="sm" className="h-9 px-3" onClick={() => void add(p)}>Зөвшөөрөх</Button>
            : <span className="text-sm text-muted-foreground">{REL_LABEL[p.relation]}</span>}
        </PersonLine>
      ))}
    </section>
  );
}
