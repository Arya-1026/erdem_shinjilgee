'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { moodById } from '@/lib/data';
import { notifyFriend, shortId, social, socialError, type FriendRow, type Person, type RequestRow, type SearchRow } from '@/lib/social';
import { ActionMenu } from './action-menu';
import { useFriendActions } from './friend-actions';
import { PersonAvatar } from './person-avatar';
import { useApp } from './providers/app-provider';
import { Segmented } from './segmented';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';
import { useT } from '@/components/providers/locale-provider';

export type SheetTab = 'friends' | 'add' | 'requests' | 'blocked';

// Утсан дээр доороос гулсаж гарна, том дэлгэцэд голд (Instagram-ын дагагчдын жагсаалт шиг)
const SHEET = 'top-auto bottom-0 left-0 h-[80dvh] max-w-full translate-x-0 translate-y-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_auto_auto_minmax(0,1fr)] gap-2.5 rounded-t-[22px] rounded-b-none px-4 pt-3 pb-[calc(12px+var(--safe-b))] ring-0 max-sm:data-open:slide-in-from-bottom-10 max-sm:data-open:zoom-in-100 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:h-[min(640px,85dvh)] sm:max-w-[440px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[22px]';

/* Ирсэн найзын хүсэлтүүд: Нүүр хуудас болон найзын цонхонд шууд зөвшөөрөх/устгах товчтой харагдана,
   тэр хүнийг хайж олох шаардлагагүй */
export function IncomingRequests({ list, onDone, onGo }: { list: RequestRow[]; onDone: () => void; onGo?: () => void }) {
  const tr = useT();
  const { supabase } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  if (!list.length) return null;
  const respond = async (r: RequestRow, accept: boolean) => {
    setBusy(r.id);
    const { error } = await supabase.rpc('respond_friend_request', { from_user: r.id, accept });
    setBusy(null);
    if (error) return void toast.error(tr(socialError(error)));
    toast(accept ? tr('{0} найз боллоо 🎉', r.name) : tr('Цуцаллаа'));
    if (accept) notifyFriend(r.id, 'accepted');
    onDone();
  };
  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 px-3 py-2" role="region" aria-label={tr('Найзын хүсэлт')}>
      <h4 className="text-sm font-semibold text-primary">{tr('📨 Найзын хүсэлт · {0}', list.length)}</h4>
      {list.map(r => (
        <Row key={r.id} p={r} href={`/friends/${r.id}`} onGo={onGo} title={r.name} sub={r.handle ? `@${r.handle}` : tr('Танд хүсэлт илгээсэн')}>
          <Button size="sm" className="h-8 px-3" disabled={busy === r.id} onClick={() => void respond(r, true)}>{tr('Хүлээн авах')}</Button>
          <Button size="sm" variant="secondary" className="h-8 px-3" disabled={busy === r.id} onClick={() => void respond(r, false)}>{tr('Цуцлах')}</Button>
        </Row>
      ))}
    </div>
  );
}

/* Найзын цонх. Таб бүр өөрийн хайлттай: Найзууд (зөвхөн найзаас), Шинэ найз (шинэ хүн), Хүсэлт, Блок.
   focus: «＋ Найз нэмэх»-ээр нээгдвэл хайлтын талбарт шууд бичих боломжтой */
export function FriendsSheet({ open, onOpenChange, tab: initial = 'friends', focus = false }: { open: boolean; onOpenChange: (o: boolean) => void; tab?: SheetTab; focus?: boolean }) {
  const tr = useT();
  const { supabase, profile } = useApp();
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

  // «Шинэ найз» таб: бичих зогсоход шинэ хүн хайна (найз биш хүмүүс)
  useEffect(() => {
    const term = q.trim();
    const t = setTimeout(() => {
      if (tab !== 'add' || term.length < 2) return setFound(null);
      social.search(supabase, term).then(r => setFound(r.filter(x => x.relation !== 'friend'))).catch(() => setFound([]));
    }, 400);
    return () => clearTimeout(t);
  }, [q, tab, supabase]);

  const actions = useFriendActions(load);
  const act = async (p: PromiseLike<{ data?: unknown; error: unknown }>, ok: string) => {
    const { error } = await p;
    if (error) return void toast.error(tr(socialError(error as Error)));
    toast(ok);
    load();
  };
  // Зөвшөөрсөн нь бичигдсэний дараа сервер шалгана
  const notifyAfter = (id: string) => setTimeout(() => notifyFriend(id, 'accepted'), 1500);
  const add = async (p: SearchRow) => {
    const { data, error } = await supabase.rpc('send_friend_request', { target: p.id });
    if (error) return void toast.error(tr(socialError(error)));
    toast(data === 'friend' ? tr('{0} найз боллоо 🎉', p.name) : tr('Найзын хүсэлт илгээлээ 📨'));
    notifyFriend(p.id, data === 'friend' ? 'accepted' : 'request');
    setFound(r => r?.map(x => (x.id === p.id ? { ...x, relation: data as SearchRow['relation'] } : x)) ?? null);
    load();
  };

  const t = q.trim().toLowerCase().replace(/^@/, '');
  const match = (p: Person) => !t || p.name.toLowerCase().includes(t) || (p.handle ?? '').includes(t);
  const incoming = requests.filter(r => r.direction === 'incoming');
  const close = () => onOpenChange(false);
  // Таб солиход хайлт цэвэрлэгдэнэ: таб бүр зөвхөн өөрийнхөө жагсаалтаас хайна
  const switchTab = (v: SheetTab) => { setTab(v); setQ(''); };
  const PLACEHOLDER: Record<SheetTab, string> = {
    friends: tr('🔍 Найзаасаа хайх'),
    add: tr('🔍 Шинэ найз хайх: нэр эсвэл ID'),
    requests: tr('🔍 Хүсэлтээс хайх'),
    blocked: tr('🔍 Блоклосноос хайх'),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={SHEET}>
        <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/30 sm:hidden" aria-hidden />
        <DialogTitle className="text-center text-base font-bold">{tr('Найзууд')}</DialogTitle>
        <DialogDescription className="sr-only">{tr('Найзаа хайх, хүсэлт, блоклосон хүмүүс')}</DialogDescription>
        <div className="flex flex-col gap-2">
          <Segmented full label={tr('Хэсэг')} value={tab} onChange={switchTab} options={[
            ['friends', tr('Найзууд{0}', friends?.length ? ` ${friends.length}` : '')],
            ['add', tr('＋ Шинэ найз')],
            ['requests', tr('Хүсэлт{0}', incoming.length ? ` ${incoming.length}` : '')],
            ['blocked', tr('Блок{0}', blocked.length ? ` ${blocked.length}` : '')],
          ]} />
          <input type="search" value={q} onChange={e => setQ(e.target.value)} autoFocus={focus} enterKeyHint="search"
            placeholder={PLACEHOLDER[tab]} aria-label={PLACEHOLDER[tab].replace('🔍 ', '')}
            className="min-h-11 w-full rounded-xl border-0 bg-secondary px-3.5 text-base focus:ring-2 focus:ring-primary focus:outline-none" />
          {/* Найз нь таныг олохын тулд өөрийн ID-г харуулна */}
          {tab === 'add' && !t && <p className="px-1 text-xs text-muted-foreground">{tr('Таны ID: {0}. Найздаа өгвөл тэр таныг хайж олно.', profile.handle ? `@${profile.handle}` : `#${shortId(profile.id)}`)}</p>}
        </div>

        <div className="min-h-0 overflow-y-auto overscroll-contain">
          {tab === 'friends' && (
            friends === null ? <Empty>{tr('Ачаалж байна…')}</Empty> : <>
              {!t && <div className="mb-2"><IncomingRequests list={incoming} onDone={load} onGo={close} /></div>}
              {friends.filter(match).map(f => (
                <Row key={f.id} p={f} mood={f.mood} href={`/friends/${f.id}`} onGo={close}
                  title={<>{f.favorite && '⭐ '}{f.name}{f.mood_hidden && <span className="ml-1 text-xs" title={tr('Та энэ хүнээс сэтгэл санаагаа нуусан')}>🙈</span>}</>}
                  sub={[f.handle && `@${f.handle}`, f.mood && `${moodById(f.mood).emoji} ${tr(moodById(f.mood).label)}`].filter(Boolean).join(' · ')}>
                  <ActionMenu items={actions(f, { isFriend: true })} label={tr('{0}: үйлдэл', f.name)} />
                </Row>
              ))}
              {!friends.filter(match).length && (t ? <Empty>{tr('Найз олдсонгүй')}</Empty> : <Empty>
                {tr('Одоогоор найз алга.')}{' '}
                <button type="button" className="font-semibold text-primary" onClick={() => switchTab('add')}>{tr('＋ Найз нэмэх')}</button>
              </Empty>)}
            </>
          )}

          {tab === 'add' && <>
              {t.length < 2 && <Empty>{tr('Найзынхаа нэр эсвэл ID-г (жишээ нь @bat эсвэл #1a2b3c4d) дээр бичнэ үү.')}</Empty>}
              {found?.map(p => (
                <Row key={p.id} p={p} href={`/friends/${p.id}`} onGo={close} title={p.name} sub={p.handle ? `@${p.handle}` : ''}>
                  {p.relation === 'none' ? <Button size="sm" className="h-8 px-3" onClick={() => void add(p)}>{tr('Нэмэх')}</Button>
                    : p.relation === 'incoming' ? <Button size="sm" className="h-8 px-3" onClick={() => void add(p)}>{tr('Зөвшөөрөх')}</Button>
                    : <span className="text-xs text-muted-foreground">{tr('Илгээсэн')}</span>}
                </Row>
              ))}
              {t.length >= 2 && found && !found.length && <Empty>{tr('Хүн олдсонгүй')}</Empty>}
          </>}

          {tab === 'requests' && <>
            {!requests.filter(match).length && <Empty>{tr('Хүсэлт алга')}</Empty>}
            {requests.filter(match).map(r => (
              <Row key={r.id} p={r} href={`/friends/${r.id}`} onGo={close} title={r.name} sub={r.direction === 'incoming' ? tr('Танд хүсэлт илгээсэн') : tr('Хариу хүлээж байна')}>
                {r.direction === 'incoming' ? <>
                  <Button size="sm" className="h-8 px-3" onClick={() => { void act(supabase.rpc('respond_friend_request', { from_user: r.id, accept: true }), tr('{0} найз боллоо 🎉', r.name)); notifyAfter(r.id); }}>{tr('Зөвшөөрөх')}</Button>
                  <Button size="sm" variant="secondary" className="h-8 px-3" onClick={() => void act(supabase.rpc('respond_friend_request', { from_user: r.id, accept: false }), tr('Татгалзлаа'))}>{tr('Устгах')}</Button>
                </> : <Button size="sm" variant="secondary" className="h-8 px-3" onClick={() => void act(supabase.rpc('remove_friend', { target: r.id }), tr('Хүсэлтээ цуцаллаа'))}>{tr('Цуцлах')}</Button>}
              </Row>
            ))}
          </>}

          {tab === 'blocked' && <>
            {!blocked.filter(match).length && <Empty>{tr('Блоклосон хүн алга')}</Empty>}
            {blocked.filter(match).map(b => (
              <Row key={b.id} p={b} title={b.name} sub={b.handle ? `@${b.handle}` : ''}>
                <Button size="sm" variant="secondary" className="h-8 px-3" onClick={() => void act(supabase.rpc('unblock_user', { target: b.id }), tr('Блокоос гаргалаа'))}>{tr('Блок цуцлах')}</Button>
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
  const tr = useT();
  const { supabase } = useApp();
  const [n, setN] = useState<{ friends: number; incoming: number } | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (open) return;
    const t = setTimeout(() => { social.counts(supabase).then(c => setN(c)).catch(() => setN(null)); }, 0);
    return () => clearTimeout(t);
  }, [supabase, open]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="relative rounded-2xl border bg-card p-3.5 text-left transition hover:border-primary">
        <span className="text-xs text-muted-foreground">{tr('Найзууд')}</span>
        <b className="block text-[1.4rem]">{n?.friends ?? '–'}</b>
        {!!n?.incoming && <span className="absolute top-2 right-2 rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground" aria-label={tr('{0} найзын хүсэлт', n.incoming)}>{n.incoming}</span>}
      </button>
      <FriendsSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
