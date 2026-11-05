'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { PersonAvatar } from '@/components/person-avatar';
import { useApp } from '@/components/providers/app-provider';
import { Button } from '@/components/ui/button';
import { moodById } from '@/lib/data';
import { today } from '@/lib/date';
import { moodAgo, shortId, social, socialError, type Message, type Person, type UserCard } from '@/lib/social';
import { cn } from '@/lib/utils';

const hm = (iso: string) => new Date(iso).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit', hour12: false });

/* Хүний профайл: харилцаа (найз нэмэх, хасах, блок), сэтгэл санаа, найзууд, зурвас */
export default function PersonPage() {
  const { id } = useParams<{ id: string }>();
  const { supabase, profile } = useApp();
  const router = useRouter();
  const [card, setCard] = useState<UserCard | null | undefined>(undefined);
  const [friends, setFriends] = useState<Person[]>([]);
  const [now] = useState(today);

  const load = useCallback(async () => {
    try {
      const c = await social.card(supabase, id);
      setCard(c);
      setFriends(c?.friends_visible && c.relation !== 'self' ? await social.userFriends(supabase, id) : []);
    } catch { setCard(null); }
  }, [supabase, id]);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);
  // Өөрийнхөө ID-г нээвэл профайл руу
  useEffect(() => { if (card?.relation === 'self') router.replace('/profile'); }, [card, router]);

  const act = async (p: PromiseLike<{ error: unknown }>, ok: string) => {
    const { error } = await p;
    if (error) return void toast.error(socialError(error as Error));
    toast(ok);
    void load();
  };

  if (card === undefined) return <p className="py-10 text-center text-muted-foreground">Ачаалж байна…</p>;
  if (!card) return (
    <div className="card-x mx-auto max-w-[520px] text-center">
      <p className="mb-3">Хэрэглэгч олдсонгүй.</p>
      <Link href="/friends" className="font-semibold text-primary">← Найзууд руу буцах</Link>
    </div>
  );
  if (card.relation === 'self') return null;

  const m = card.mood ? moodById(card.mood) : null;
  const block = () => {
    if (!confirm(`${card.name}-г блоклох уу? Найзаас хасагдаж, тэр танд бичих, таныг хайж олох боломжгүй болно.`)) return;
    void act(supabase.rpc('block_user', { target: card.id }), 'Блоклолоо').then(() => router.push('/friends'));
  };

  return (
    <div className="mx-auto grid max-w-[980px] gap-4 desk:grid-cols-[1fr_1.4fr] desk:items-start">
      <section className="card-x flex flex-col gap-3">
        <Link href="/friends" className="text-sm font-semibold text-primary">← Найзууд</Link>
        <div className="flex items-center gap-3.5">
          <PersonAvatar name={card.name} avatar={card.avatar} className="size-16 text-2xl" />
          <div className="min-w-0">
            <h2 className="truncate text-[1.15rem] font-bold">{card.name}</h2>
            <p className="text-sm text-muted-foreground">{card.handle ? `@${card.handle} · ` : ''}ID {shortId(card.id)}{card.is_private ? ' · 🔒' : ''}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-secondary/60 p-3 text-sm">
          {m ? <><span className="text-2xl">{m.emoji}</span> <b>{m.label}</b> <span className="text-muted-foreground">· {moodAgo(card.mood_date, now)}</span></>
            : <span className="text-muted-foreground">🔒 Сэтгэл санаа нь танд харагдахгүй байна</span>}
        </div>

        <div className="flex flex-wrap gap-2">
          {card.relation === 'none' && <Button onClick={() => void act(supabase.rpc('send_friend_request', { target: card.id }), 'Найзын хүсэлт илгээлээ 📨')}>＋ Найз нэмэх</Button>}
          {card.relation === 'incoming' && <>
            <Button onClick={() => void act(supabase.rpc('respond_friend_request', { from_user: card.id, accept: true }), `${card.name} найз боллоо 🎉`)}>Хүсэлт зөвшөөрөх</Button>
            <Button variant="outline" onClick={() => void act(supabase.rpc('respond_friend_request', { from_user: card.id, accept: false }), 'Татгалзлаа')}>Татгалзах</Button>
          </>}
          {card.relation === 'outgoing' && <Button variant="outline" onClick={() => void act(supabase.rpc('remove_friend', { target: card.id }), 'Хүсэлтээ цуцаллаа')}>Хүсэлт цуцлах</Button>}
          {card.relation === 'friend' && <Button variant="outline" onClick={() => { if (confirm(`${card.name}-г найзаас хасах уу?`)) void act(supabase.rpc('remove_friend', { target: card.id }), 'Найзаас хаслаа'); }}>Найзаас хасах</Button>}
          <Button variant="ghost" className="text-destructive" onClick={block}>🚫 Блоклох</Button>
        </div>

        <div>
          <h3 className="mb-1 text-sm font-semibold">Найзууд{card.friends_count != null && ` · ${card.friends_count}`}</h3>
          {!card.friends_visible ? <p className="text-sm text-muted-foreground">🔒 Найзуудаа нуусан байна</p>
            : !friends.length ? <p className="text-sm text-muted-foreground">Харуулах найз алга</p>
            : (
              <div className="flex flex-wrap gap-2">
                {friends.slice(0, 24).map(f => (
                  <Link key={f.id} href={f.id === profile.id ? '/profile' : `/friends/${f.id}`} title={f.name} className="flex items-center gap-1.5 rounded-full border bg-card py-1 pr-3 pl-1 text-sm">
                    <PersonAvatar name={f.name} avatar={f.avatar} className="size-7 text-xs" />{f.name}
                  </Link>
                ))}
              </div>
            )}
        </div>
      </section>

      {card.can_message ? <Chat other={card} />
        : <section className="card-x text-center text-sm text-muted-foreground">✉️ {card.relation === 'friend' ? `${card.name} одоогоор зурвас хүлээж авахгүй байна.` : `${card.name} зөвхөн найзаасаа зурвас хүлээж авдаг. Эхлээд найз болоорой.`}</section>}
    </div>
  );
}

/* Хоёр хүний зурвас. 4 секунд тутам шинэчилж, нээлттэй байхад ирсэн зурвасыг уншсан болгоно. */
function Chat({ other }: { other: UserCard }) {
  const { supabase, profile } = useApp();
  const [msgs, setMsgs] = useState<Message[] | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const last = useRef(0);

  const load = useCallback(async () => {
    try {
      const list = await social.messages(supabase, profile.id, other.id);
      setMsgs(list);
      if (list.some(m => m.sender === other.id && !m.read_at)) await supabase.rpc('mark_read', { from_user: other.id });
    } catch { setMsgs(m => m ?? []); }
  }, [supabase, profile.id, other.id]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    const id = setInterval(() => { if (!document.hidden) void load(); }, 4000);
    return () => { clearTimeout(t); clearInterval(id); };
  }, [load]);

  // Шинэ зурвас ирэхэд доош гүйлгэнэ
  useEffect(() => {
    if (msgs && msgs.length !== last.current) { last.current = msgs.length; box.current?.scrollTo({ top: box.current.scrollHeight }); }
  }, [msgs]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const { data, error } = await supabase.rpc('send_message', { target: other.id, body });
    setSending(false);
    if (error) return void toast.error(socialError(error));
    setText('');
    setMsgs(m => [...(m ?? []), data as Message]);
  }

  return (
    <section className="card-x flex h-[min(70dvh,620px)] flex-col">
      <h3 className="mb-2 font-semibold">💬 {other.name}</h3>
      <div ref={box} className="flex flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain py-1" aria-live="polite">
        {msgs === null ? <p className="m-auto text-sm text-muted-foreground">Ачаалж байна…</p>
          : !msgs.length ? <p className="m-auto text-center text-sm text-muted-foreground">Анхны зурвасаа бичээрэй 👋</p>
          : msgs.map(m => {
            const mine = m.sender === profile.id;
            return (
              <div key={m.id} className={cn('flex max-w-[82%] flex-col', mine ? 'self-end items-end' : 'self-start items-start')}>
                <div className={cn('rounded-[16px] px-3 py-2 whitespace-pre-wrap [overflow-wrap:anywhere]', mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md border bg-background')}>{m.body}</div>
                <span className="px-1 text-[.68rem] text-muted-foreground">{hm(m.created_at)}{mine && m.read_at ? ' · уншсан' : ''}</span>
              </div>
            );
          })}
      </div>
      <form className="flex gap-2 pt-2" onSubmit={e => void send(e)}>
        <input className="min-h-11 min-w-0 flex-1 rounded-xl border-[1.5px] bg-background px-3 focus:border-primary focus:outline-none" placeholder="Зурвас бичих…" aria-label="Зурвас" value={text} maxLength={2000} onChange={e => setText(e.target.value)} />
        <Button type="submit" size="xl" className="h-11 flex-none" disabled={sending || !text.trim()}>➤</Button>
      </form>
    </section>
  );
}
