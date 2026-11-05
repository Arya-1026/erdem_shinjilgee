'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ActionMenu, type MenuItem } from '@/components/action-menu';
import { useFriendActions } from '@/components/friend-actions';
import { FriendsSheet, type SheetTab } from '@/components/friends-tile';
import { PersonAvatar } from '@/components/person-avatar';
import { useApp } from '@/components/providers/app-provider';
import { Chip } from '@/components/segmented';
import { Button } from '@/components/ui/button';
import { moodById } from '@/lib/data';
import { filterChats, isActive, shortAgo, social, socialError, type ChatFilter, type ChatRow, type FriendRow } from '@/lib/social';
import { cn } from '@/lib/utils';

const preview = (s: string | null) => (s && s.length > 60 ? s.slice(0, 60) + '…' : s);
const firstName = (n: string) => n.split(/[\s.]+/).filter(Boolean).pop() ?? n;

/* Messenger шиг чатын жагсаалт: хайлт, идэвхтэй найзуудын эгнээ, яриа (сүүлийн зурвас, хугацаа, уншаагүй).
   Найз нэмэх, хүсэлт, блок нь профайлын найзын цонхонд (FriendsSheet). */
export default function ChatsPage() {
  const { supabase } = useApp();
  const params = useSearchParams();
  // Хуучин холбоос (/friends?tab=requests) ирвэл цонхыг тэр табаар нээнэ
  const initial = params.get('tab');
  const [sheet, setSheet] = useState<SheetTab | null>(initial === 'requests' || initial === 'blocked' ? initial : initial === 'search' ? 'friends' : null);
  const [friends, setFriends] = useState<FriendRow[] | null>(null);
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [incoming, setIncoming] = useState(0);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<ChatFilter>('all');
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    try {
      const [f, c, n] = await Promise.all([social.friends(supabase), social.otherChats(supabase), social.counts(supabase)]);
      setFriends(f); setChats(c); setIncoming(n.incoming); setNow(Date.now());
    } catch (e) {
      setFriends([]);
      toast.error(socialError(e as Error));
    }
  }, [supabase]);
  useEffect(() => {
    // Шинэ зурвас, идэвхтэй байдал 15 секунд тутам шинэчлэгдэнэ
    const t = setTimeout(() => void load(), 0);
    const id = setInterval(() => { if (!document.hidden) void load(); }, 15_000);
    return () => { clearTimeout(t); clearInterval(id); };
  }, [load]);

  const friendActions = useFriendActions(() => void load());
  const menu = (p: FriendRow, isFriend: boolean): MenuItem[] => friendActions(p, { isFriend, chat: true });

  // Нэг жагсаалт: найзуудтай болон бусадтай хийсэн яриа, сүүлийн зурвасаар эрэмбэлнэ
  const all: (FriendRow & { isFriend: boolean })[] = [
    ...(friends ?? []).map(f => ({ ...f, isFriend: true })),
    ...chats.map(c => ({ ...c, mood: null, mood_date: null, mood_hidden: false, favorite: false, active_at: null, isFriend: false })),
  ];
  const list = filterChats(all, q, filter).sort((a, b) => (b.last_at ?? '').localeCompare(a.last_at ?? '') || Number(b.favorite) - Number(a.favorite));
  // Идэвхтэй эгнээ: онлайн нь эхэнд, дараа нь favorite, сүүлд идэвхтэй байсан
  const strip = [...(friends ?? [])].sort((a, b) => Number(isActive(b.active_at, now)) - Number(isActive(a.active_at, now))
    || Number(b.favorite) - Number(a.favorite) || (b.active_at ?? '').localeCompare(a.active_at ?? ''));
  const archivedN = all.filter(x => x.archived).length, unreadN = all.filter(x => !x.archived && x.unread > 0).length;

  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-3">
      <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 Хайх" aria-label="Чат хайх"
        className="min-h-11 w-full rounded-full border-0 bg-secondary px-4 focus:ring-2 focus:ring-primary focus:outline-none" />

      {/* Идэвхтэй найзууд (Messenger-ийн дээд эгнээ) */}
      {strip.length > 0 && (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 no-scrollbar" aria-label="Найзууд">
          {strip.map(f => {
            const on = isActive(f.active_at, now);
            return (
              <Link key={f.id} href={`/friends/${f.id}`} className="flex w-16 flex-none flex-col items-center gap-1 text-center">
                <span className="relative">
                  <PersonAvatar name={f.name} avatar={f.avatar} className="size-14 text-xl" />
                  {on ? <i className="absolute right-0 bottom-0 size-4 rounded-full border-[3px] border-background bg-green-500" aria-label="Идэвхтэй" />
                    : f.active_at && <span className="absolute -right-1 bottom-0 rounded-full border-2 border-background bg-secondary px-1 text-[.6rem] font-bold text-green-600">{shortAgo(f.active_at, now)}</span>}
                  {f.mood && <span className="absolute -top-1 -right-1 text-base" title={moodById(f.mood).label}>{moodById(f.mood).emoji}</span>}
                </span>
                <span className="w-full truncate text-xs">{firstName(f.name)}</span>
              </Link>
            );
          })}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        <Chip on={filter === 'all'} onClick={() => setFilter('all')}>Бүгд</Chip>
        <Chip on={filter === 'unread'} onClick={() => setFilter('unread')}>Уншаагүй{unreadN ? ` ${unreadN}` : ''}</Chip>
        <Chip on={filter === 'archived'} onClick={() => setFilter('archived')}>Архив{archivedN ? ` ${archivedN}` : ''}</Chip>
        <Chip onClick={() => setSheet('requests')} className={cn(incoming > 0 && 'border-primary')}>Хүсэлт{incoming ? ` ${incoming}` : ''}</Chip>
        <Chip onClick={() => setSheet('friends')}>＋ Найз нэмэх</Chip>
      </div>

      <section className="flex flex-col">
        {friends === null ? <p className="py-10 text-center text-sm text-muted-foreground">Ачаалж байна…</p>
          : !all.length ? (
            <div className="py-10 text-center">
              <p className="mb-3 text-sm text-muted-foreground">Одоогоор чат алга. Найзаа нэмээд бичиж эхлээрэй.</p>
              <Button size="xl" onClick={() => setSheet('friends')}>＋ Найз нэмэх</Button>
            </div>
          ) : !list.length ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{filter === 'archived' ? 'Архивласан чат алга.' : filter === 'unread' ? 'Уншаагүй зурвас алга 🎉' : 'Олдсонгүй.'}</p>
          ) : list.map(c => {
            const on = isActive(c.active_at, now), bold = c.unread > 0;
            return (
              <div key={c.id} className="group flex items-center gap-1 rounded-2xl px-2 hover:bg-secondary/60">
                <Link href={`/friends/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-2">
                  <span className="relative flex-none">
                    <PersonAvatar name={c.name} avatar={c.avatar} className="size-14 text-xl" />
                    {on && <i className="absolute right-0 bottom-0 size-4 rounded-full border-[3px] border-background bg-green-500" aria-label="Идэвхтэй" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate', bold ? 'font-bold' : 'font-medium')}>
                      {c.favorite && '⭐ '}{c.name}{c.mood && ` ${moodById(c.mood).emoji}`}{c.mood_hidden && <span className="ml-1 text-xs" title="Та энэ хүнээс сэтгэл санаагаа нуусан">🙈</span>}
                    </span>
                    <span className={cn('flex min-w-0 gap-1 text-sm', bold ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                      <span className="truncate">{c.last_body ? `${c.last_mine ? 'Та: ' : ''}${preview(c.last_body)}` : on ? 'Идэвхтэй байна · Сайн уу гэж бичээрэй 👋' : 'Зурвас бичих'}</span>
                      {c.last_at && <span className="flex-none">· {shortAgo(c.last_at, now)}</span>}
                    </span>
                  </span>
                  {bold && <i className="size-3 flex-none rounded-full bg-primary" aria-label={`${c.unread} уншаагүй`} />}
                </Link>
                <ActionMenu items={menu(c, c.isFriend)} label={`${c.name}: үйлдэл`} className="desk:opacity-0 desk:group-hover:opacity-100 desk:focus-within:opacity-100" />
              </div>
            );
          })}
      </section>

      <FriendsSheet open={sheet !== null} tab={sheet ?? 'friends'} onOpenChange={o => { if (!o) { setSheet(null); void load(); } }} />
    </div>
  );
}
