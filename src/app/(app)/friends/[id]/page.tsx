'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ActionMenu, type MenuItem } from '@/components/action-menu';
import { PersonAvatar } from '@/components/person-avatar';
import { useApp } from '@/components/providers/app-provider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
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
  // Ярианы түүх устгасны дараа чатыг дахин ачаална
  const [chatKey, setChatKey] = useState(0);

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

        {/* Ерөнхий нууцлалаас гадна тухайн хүнээс сэтгэл санаагаа нууж болно */}
        <label className="flex items-center justify-between gap-3 rounded-2xl border p-3 text-sm">
          <span><b className="block">Миний сэтгэл санааг харуулах</b><span className="text-muted-foreground">{card.mood_hidden ? `${card.name}-аас нуусан` : `${card.name} таны сүүлийн бүртгэлийг харж болно (профайлын тохиргооны дагуу)`}</span></span>
          <Switch checked={!card.mood_hidden} aria-label="Миний сэтгэл санааг харуулах"
            onCheckedChange={v => void act(supabase.rpc('set_mood_hidden', { target: card.id, hidden: !v }), v ? 'Сэтгэл санаагаа харууллаа' : 'Сэтгэл санаагаа нууллаа 🙈')} />
        </label>

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

      {card.can_message ? <Chat other={card} menu={[
        { label: card.archived ? '📤 Архиваас гаргах' : '🗄️ Яриаг архивлах', onSelect: () => void act(supabase.rpc('set_chat_archived', { partner: card.id, archived: !card.archived }), card.archived ? 'Архиваас гаргалаа' : 'Архивлалаа') },
        { label: card.mood_hidden ? '🙂 Сэтгэл санаагаа харуулах' : '🙈 Сэтгэл санаагаа нуух', onSelect: () => void act(supabase.rpc('set_mood_hidden', { target: card.id, hidden: !card.mood_hidden }), card.mood_hidden ? 'Сэтгэл санаагаа харууллаа' : 'Сэтгэл санаагаа нууллаа 🙈') },
        { label: '🗑️ Ярианы түүх устгах', danger: true, onSelect: () => { if (confirm('Энэ ярианы түүхийг өөрөөсөө устгах уу? Нөгөө хүнд хэвээр үлдэнэ.')) void act(supabase.rpc('delete_chat', { partner: card.id }), 'Ярианы түүх устлаа').then(() => setChatKey(k => k + 1)); } },
        { label: '🚫 Блоклох', danger: true, onSelect: block },
      ]} key={chatKey} />
        : <section className="card-x text-center text-sm text-muted-foreground">✉️ {card.relation === 'friend' ? `${card.name} одоогоор зурвас хүлээж авахгүй байна.` : `${card.name} зөвхөн найзаасаа зурвас хүлээж авдаг. Эхлээд найз болоорой.`}</section>}
    </div>
  );
}

/* Хоёр хүний зурвас. 4 секунд тутам шинэчилж, нээлттэй байхад ирсэн зурвасыг уншсан болгоно. */
function Chat({ other, menu }: { other: UserCard; menu: MenuItem[] }) {
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

  // «Надаас устгах» эсвэл (өөрийн зурвасыг) «Бүгдээс буцаах»
  async function remove(m: Message, forAll: boolean) {
    if (forAll && !confirm('Энэ зурвасыг хоёуланд нь устгах уу?')) return;
    const { error } = await supabase.rpc('delete_message', { msg_id: m.id, for_all: forAll });
    if (error) return void toast.error(socialError(error));
    setMsgs(list => list?.filter(x => x.id !== m.id) ?? null);
    toast(forAll ? 'Зурвасыг буцаалаа' : 'Зурвас устлаа');
  }

  return (
    <section className="card-x flex h-[min(70dvh,620px)] flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate font-semibold">💬 {other.name}{other.archived && <span className="ml-1.5 text-xs font-normal text-muted-foreground">🗄️ архивласан</span>}</h3>
        <ActionMenu items={menu} label="Ярианы үйлдэл" />
      </div>
      <div ref={box} className="flex flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain py-1" aria-live="polite">
        {msgs === null ? <p className="m-auto text-sm text-muted-foreground">Ачаалж байна…</p>
          : !msgs.length ? <p className="m-auto text-center text-sm text-muted-foreground">Анхны зурвасаа бичээрэй 👋</p>
          : msgs.map(m => {
            const mine = m.sender === profile.id;
            return (
              <div key={m.id} className={cn('group flex max-w-[86%] items-center gap-0.5', mine ? 'self-end flex-row-reverse' : 'self-start')}>
                <div className={cn('flex min-w-0 flex-col', mine ? 'items-end' : 'items-start')}>
                  <div className={cn('rounded-[16px] px-3 py-2 whitespace-pre-wrap [overflow-wrap:anywhere]', mine ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md border bg-background')}>{m.body}</div>
                  <span className="px-1 text-[.68rem] text-muted-foreground">{hm(m.created_at)}{mine && m.read_at ? ' · уншсан' : ''}</span>
                </div>
                {/* Утсан дээр үргэлж, компьютер дээр хулгана аваачихад харагдана */}
                <ActionMenu className="opacity-70 desk:opacity-0 desk:group-hover:opacity-100 desk:focus-within:opacity-100" align={mine ? 'right' : 'left'} label="Зурвасны үйлдэл" items={[
                  { label: '🗑️ Надаас устгах', onSelect: () => void remove(m, false) },
                  mine && { label: '↩️ Бүгдээс буцаах', danger: true, onSelect: () => void remove(m, true) },
                  { label: '📋 Хуулах', onSelect: () => void navigator.clipboard?.writeText(m.body).then(() => toast('Хуулагдлаа')) },
                ]} />
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
