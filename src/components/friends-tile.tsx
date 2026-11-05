'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { moodById } from '@/lib/data';
import { social, socialError, type FriendRow, type Person, type RequestRow, type SearchRow } from '@/lib/social';
import { ActionMenu } from './action-menu';
import { useFriendActions } from './friend-actions';
import { PersonAvatar } from './person-avatar';
import { useApp } from './providers/app-provider';
import { Segmented } from './segmented';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';

export type SheetTab = 'friends' | 'requests' | 'blocked';

// Утсан дээр доороос гулсаж гарна, том дэлгэцэд голд (Instagram-ын дагагчдын жагсаалт шиг)
const SHEET = 'top-auto bottom-0 left-0 h-[80dvh] max-w-full translate-x-0 translate-y-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_auto_auto_minmax(0,1fr)] gap-2.5 rounded-t-[22px] rounded-b-none px-4 pt-3 pb-[calc(12px+var(--safe-b))] ring-0 max-sm:data-open:slide-in-from-bottom-10 max-sm:data-open:zoom-in-100 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:h-[min(640px,85dvh)] sm:max-w-[440px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[22px]';

/* Профайл дээрх найзын цонх: хайх (найзаа шүүх + шинэ хүн олж нэмэх), хүсэлт, блок */
export function FriendsSheet({ open, onOpenChange, tab: initial = 'friends' }: { open: boolean; onOpenChange: (o: boolean) => void; tab?: SheetTab }) {
  const { supabase } = useApp();
  const [tab, setTab] = useState<SheetTab>(initial);
  const [q, setQ] = useState('');
  const [friends, setFriends] = useState<FriendRow[] | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [blocked, setBlocked] = useState<Person[]>([]);
  const [found, setFound] = useState<SearchRow[] | null>(null);

  const load = useCallback(() => {
    Promise.all([social.friends(supabase), social.requests(supabase), social.blocked(supabase)])
      .then(([f, r, b]) => { setFriends(f); setRequests(r); setBlocked(b); })
      .catch(() => setFriends([]));
  }, [supabase]);
  useEffect(() => { if (!open) return; const t = setTimeout(load, 0); return () => clearTimeout(t); }, [open, load]);
  // Цонх өөр табаар нээгдэх бүрт тэр таб руу шилжинэ
  useEffect(() => { if (!open) return; const t = setTimeout(() => { setTab(initial); setQ(''); }, 0); return () => clearTimeout(t); }, [open, initial]);

  // Бичих зогсоход шинэ хүн хайна (найз биш хүмүүс)
  useEffect(() => {
    const term = q.trim();
    const t = setTimeout(() => {
      if (tab !== 'friends' || term.length < 2) return setFound(null);
      social.search(supabase, term).then(r => setFound(r.filter(x => x.relation !== 'friend'))).catch(() => setFound([]));
    }, 400);
    return () => clearTimeout(t);
  }, [q, tab, supabase]);

  const actions = useFriendActions(load);
  const act = async (p: PromiseLike<{ data?: unknown; error: unknown }>, ok: string) => {
    const { error } = await p;
    if (error) return void toast.error(socialError(error as Error));
    toast(ok);
    load();
  };
  const add = async (p: SearchRow) => {
    const { data, error } = await supabase.rpc('send_friend_request', { target: p.id });
    if (error) return void toast.error(socialError(error));
    toast(data === 'friend' ? `${p.name} найз боллоо 🎉` : 'Найзын хүсэлт илгээлээ 📨');
    setFound(r => r?.map(x => (x.id === p.id ? { ...x, relation: data as SearchRow['relation'] } : x)) ?? null);
    load();
  };

  const t = q.trim().toLowerCase().replace(/^@/, '');
  const match = (p: Person) => !t || p.name.toLowerCase().includes(t) || (p.handle ?? '').includes(t);
  const incoming = requests.filter(r => r.direction === 'incoming');
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SHEET}>
        <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/30 sm:hidden" aria-hidden />
        <DialogTitle className="text-center text-base font-bold">Найзууд</DialogTitle>
        <DialogDescription className="sr-only">Найзаа хайх, хүсэлт, блоклосон хүмүүс</DialogDescription>
        <div className="flex flex-col gap-2">
          <Segmented full label="Хэсэг" value={tab} onChange={setTab} options={[
            ['friends', `Найзууд${friends?.length ? ` ${friends.length}` : ''}`],
            ['requests', `Хүсэлт${incoming.length ? ` ${incoming.length}` : ''}`],
            ['blocked', `Блок${blocked.length ? ` ${blocked.length}` : ''}`],
          ]} />
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder={tab === 'friends' ? '🔍 Хайх: нэр эсвэл ID' : '🔍 Хайх'} aria-label="Хайх"
            className="min-h-10 w-full rounded-xl border-0 bg-secondary px-3.5 text-sm focus:ring-2 focus:ring-primary focus:outline-none" />
        </div>

        <div className="min-h-0 overflow-y-auto overscroll-contain">
          {tab === 'friends' && (
            friends === null ? <Empty>Ачаалж байна…</Empty> : <>
              {friends.filter(match).map(f => (
                <Row key={f.id} p={f} mood={f.mood} href={`/friends/${f.id}`} onGo={close}
                  title={<>{f.favorite && '⭐ '}{f.name}{f.mood_hidden && <span className="ml-1 text-xs" title="Та энэ хүнээс сэтгэл санаагаа нуусан">🙈</span>}</>}
                  sub={[f.handle && `@${f.handle}`, f.mood && `${moodById(f.mood).emoji} ${moodById(f.mood).label}`].filter(Boolean).join(' · ')}>
                  <ActionMenu items={actions(f, { isFriend: true })} label={`${f.name}: үйлдэл`} />
                </Row>
              ))}
              {!friends.filter(match).length && !t && <Empty>Одоогоор найз алга. Дээр нэр эсвэл ID бичиж хайгаарай.</Empty>}
              {found && found.length > 0 && <h3 className="mt-3 mb-1 text-xs font-semibold text-muted-foreground">Бусад хүмүүс</h3>}
              {found?.map(p => (
                <Row key={p.id} p={p} href={`/friends/${p.id}`} onGo={close} title={p.name} sub={p.handle ? `@${p.handle}` : ''}>
                  {p.relation === 'none' ? <Button size="sm" className="h-8 px-3" onClick={() => void add(p)}>Нэмэх</Button>
                    : p.relation === 'incoming' ? <Button size="sm" className="h-8 px-3" onClick={() => void add(p)}>Зөвшөөрөх</Button>
                    : <span className="text-xs text-muted-foreground">Илгээсэн</span>}
                </Row>
              ))}
              {t.length >= 2 && found && !found.length && !friends.filter(match).length && <Empty>Хүн олдсонгүй</Empty>}
            </>
          )}

          {tab === 'requests' && <>
            {!requests.filter(match).length && <Empty>Хүсэлт алга</Empty>}
            {requests.filter(match).map(r => (
              <Row key={r.id} p={r} href={`/friends/${r.id}`} onGo={close} title={r.name} sub={r.direction === 'incoming' ? 'Танд хүсэлт илгээсэн' : 'Хариу хүлээж байна'}>
                {r.direction === 'incoming' ? <>
                  <Button size="sm" className="h-8 px-3" onClick={() => void act(supabase.rpc('respond_friend_request', { from_user: r.id, accept: true }), `${r.name} найз боллоо 🎉`)}>Зөвшөөрөх</Button>
                  <Button size="sm" variant="secondary" className="h-8 px-3" onClick={() => void act(supabase.rpc('respond_friend_request', { from_user: r.id, accept: false }), 'Татгалзлаа')}>Устгах</Button>
                </> : <Button size="sm" variant="secondary" className="h-8 px-3" onClick={() => void act(supabase.rpc('remove_friend', { target: r.id }), 'Хүсэлтээ цуцаллаа')}>Цуцлах</Button>}
              </Row>
            ))}
          </>}

          {tab === 'blocked' && <>
            {!blocked.filter(match).length && <Empty>Блоклосон хүн алга</Empty>}
            {blocked.filter(match).map(b => (
              <Row key={b.id} p={b} title={b.name} sub={b.handle ? `@${b.handle}` : ''}>
                <Button size="sm" variant="secondary" className="h-8 px-3" onClick={() => void act(supabase.rpc('unblock_user', { target: b.id }), 'Блокоос гаргалаа')}>Блок цуцлах</Button>
              </Row>
            ))}
          </>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ p, mood, href, onGo, title, sub, children }: {
  p: Person; mood?: FriendRow['mood']; href?: string; onGo?: () => void; title: React.ReactNode; sub?: string; children?: React.ReactNode;
}) {
  const body = (
    <>
      <PersonAvatar name={p.name} avatar={p.avatar ?? null} mood={mood} className="size-11" />
      <span className="min-w-0">
        <b className="block truncate text-sm">{title}</b>
        {sub && <span className="block truncate text-xs text-muted-foreground">{sub}</span>}
      </span>
    </>
  );
  return (
    <div className="flex items-center gap-2 py-1.5">
      {href ? <Link href={href} onClick={onGo} className="flex min-w-0 flex-1 items-center gap-3">{body}</Link>
        : <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>}
      <div className="flex flex-none items-center gap-1.5">{children}</div>
    </div>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>;

/* Профайлын Бүртгэл/Дасгал/Streak-ийн хажууд «Найзууд» тоо: дарахад найзын цонх гарна */
export function FriendsTile() {
  const { supabase } = useApp();
  const [n, setN] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => { social.counts(supabase).then(c => setN(c.friends)).catch(() => setN(null)); }, 0);
    return () => clearTimeout(t);
  }, [supabase, open]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-2xl border bg-card p-3.5 text-left transition hover:border-primary">
        <span className="text-xs text-muted-foreground">Найзууд</span>
        <b className="block text-[1.4rem]">{n ?? '–'}</b>
      </button>
      <FriendsSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
