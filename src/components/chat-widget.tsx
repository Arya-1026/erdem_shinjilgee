'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useApp } from './providers/app-provider';
import { songTrack } from './providers/player-provider';
import { Chip, Segmented } from './segmented';
import { Button, buttonVariants } from './ui/button';
import { useDrag } from './use-drag';
import { usePlay } from './use-play';
import { todaysEntries } from '@/lib/analytics';
import { greeting } from '@/lib/chat-fallback';
import { CHAT_ACTIONS, extractInlineActions, splitActions, type ChatAction } from '@/lib/chat-prompt';
import { QUICK, moodById } from '@/lib/data';
import { cn } from '@/lib/utils';
import type { ChatMessage, ChatMode, SongRec } from '@/lib/types';

const MODES: [ChatMode, string][] = [['calm', '🌊 Тайван'], ['motivate', '💪 Урам'], ['listen', '👂 Сонсох']];

/* Хөвөгч чат: аль ч хуудаснаас хүрч болох товч ба самбар. Хоёуланг нь чирч дөрвөн булангийн аль нэгэнд тавина, цэс, тоглуулагчийг дардаггүй. */
export function ChatWidget() {
  const { chatOpen, setChatOpen } = useApp();
  const [opened, setOpened] = useState(false); // Анх нээх хүртэл мессеж татахгүй
  if (chatOpen && !opened) setOpened(true);
  const [bubble, bubbleDrag] = useDrag('chat-bubble', !chatOpen, 'corners');
  const [panel, panelDrag] = useDrag('chat-panel', chatOpen, 'corners');
  const down = useRef({ x: 0, y: 0 });

  return (
    <>
      <div ref={bubble} className={cn('chat-bubble no-print fixed z-34', chatOpen && 'hidden')}>
        <button type="button" aria-label="AI туслах нээх" title="AI туслах (чирж зөөнө)" {...bubbleDrag}
          className="grid size-14 touch-none place-items-center rounded-full bg-primary text-2xl text-primary-foreground shadow-[0_8px_24px_rgba(0,0,0,.3)] transition-transform active:scale-95"
          onPointerDown={e => { down.current = { x: e.clientX, y: e.clientY }; bubbleDrag.onPointerDown(e); }}
          // Чирсний дараа click бас ирдэг: бага хөдөлсөн үед л нээнэ
          onClick={e => { if (Math.hypot(e.clientX - down.current.x, e.clientY - down.current.y) < 6) setChatOpen(true); }}>
          💬
        </button>
      </div>
      <section ref={panel} role="dialog" aria-label="AI туслах" className={cn('chat-panel no-print fixed z-34 flex flex-col overflow-hidden rounded-2xl border bg-background shadow-[0_12px_40px_rgba(0,0,0,.3)]', !chatOpen && 'hidden')}>
        <header className="flex flex-none items-center gap-1 border-b bg-card pr-1.5">
          <div {...panelDrag} className="flex min-w-0 flex-1 cursor-grab touch-none items-center gap-2 py-3 pl-3.5 font-bold select-none active:cursor-grabbing" title="Чирж зөөх">
            💬 AI туслах <i className="h-1 w-8 rounded-full bg-border" aria-hidden="true" />
          </div>
          <button type="button" className="grid size-10 flex-none place-items-center rounded-full text-lg" aria-label="Хураах" onClick={() => setChatOpen(false)}>⌄</button>
        </header>
        {opened && <ChatBody />}
      </section>
    </>
  );
}

function ChatBody() {
  const { supabase, profile, entries, updateProfile, openDialog, activeMood, experts, chatOpen, setChatOpen } = useApp();
  const play = usePlay();
  const router = useRouter();
  const [msgs, setMsgs] = useState<ChatMessage[] | null>(null);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.from('chat_messages').select('id,role,content,crisis').order('created_at').limit(60)
      .then(({ data }) => setMsgs((data as ChatMessage[]) ?? []));
  }, [supabase]);

  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [msgs, typing, chatOpen]);

  async function send(raw: string) {
    const t = raw.trim(); if (!t || typing) return;
    setMsgs(m => [...(m ?? []), { id: 'u' + Date.now(), role: 'user', content: t, crisis: false }]);
    setText(''); if (input.current) input.current.style.height = '';
    setTyping(true);
    try {
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: t }) });
      if (!res.ok) throw new Error(String(res.status));
      const j: { reply?: string; crisis?: boolean } = await res.json();
      setMsgs(m => [...(m ?? []), { id: 'a' + Date.now(), role: 'assistant', content: j.reply ?? '', crisis: Boolean(j.crisis) }]);
    } catch {
      toast.error('Мессеж илгээгдсэнгүй. Дахин оролдоно уу.');
    } finally {
      setTyping(false);
    }
  }

  async function clear() {
    const { error } = await supabase.from('chat_messages').delete().eq('user_id', profile.id);
    if (error) return toast.error(error.message);
    setMsgs([]);
  }

  // AI-ийн санал болгосон үйлдэл: дасгалын цонх нээх, дуу/ая тоглуулах, хуудас руу шилжих
  function runAction(a: ChatAction) {
    const EX: Partial<Record<ChatAction, string>> = { grounding: 'e2', walk: 'e3', journal: 'e5', relax: 'e6', plan: 'e9', partner: 'e10' };
    if (a === 'breath') return openDialog({ kind: 'breath' });
    if (EX[a]) return openDialog({ kind: 'exercise', recId: EX[a]! });
    if (a === 'experts') { setChatOpen(false); return router.push('/experts'); }
    if (a === 'music') return void play.mood(activeMood.id);
    if (a === 'ambient') {
      fetch(`/api/music/recs?mood=${activeMood.id}&kind=ambient`).then(r => r.json())
        .then((j: { recs?: SongRec[] }) => j.recs?.length ? play.list(j.recs.map(r => songTrack(r, activeMood.id)), 0) : play.mood(activeMood.id))
        .catch(() => play.mood(activeMood.id));
    }
  }

  const todayMood = todaysEntries(entries)[0];
  const hello: ChatMessage = { id: 'hello', role: 'assistant', crisis: false, content: greeting(profile.name, todayMood && moodById(todayMood.mood).label) };

  return (
    <div className="flex min-h-0 flex-1 flex-col px-3 pt-2 pb-2">
      <Segmented full label="Хариултын горим" className="text-xs" value={profile.chat_mode} onChange={v => updateProfile({ chat_mode: v })} options={MODES} />
      <button className="mt-1 self-end text-xs text-muted-foreground" onClick={clear}>Цэвэрлэх</button>
      <div ref={box} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-0.5 py-2" aria-live="polite">
        {msgs && [hello, ...msgs].map(m => {
          if (m.crisis) return <Crisis key={m.id} />;
          const split = m.role === 'assistant' ? splitActions(m.content) : { text: m.content, actions: [], experts: [] };
          // Хуучин хариултуудад текст дотор үлдсэн кодыг («partner») ч товч болгоно
          const inline = m.role === 'assistant' ? extractInlineActions(split.text) : { text: split.text, actions: [] };
          const text = inline.text, picks = split.experts;
          const actions = [...new Set([...split.actions, ...inline.actions])].slice(0, 3);
          const recs = picks.flatMap(id => experts.filter(e => e.id === id));
          return (
            <div key={m.id} className={cn('flex max-w-[90%] flex-col gap-1.5', m.role === 'user' ? 'self-end items-end' : 'self-start items-start')}>
              <div className={cn('rounded-[18px] px-3.5 py-2.5 whitespace-pre-wrap [overflow-wrap:anywhere]',
                m.role === 'user' ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md border bg-card')}>{text}</div>
              {recs.map(e => (
                <div key={e.id} className="flex w-full max-w-[360px] items-center gap-3 rounded-2xl border bg-card p-3">
                  <span className="grid size-11 flex-none place-items-center rounded-full text-lg font-bold text-white" style={{ background: e.color }}>{e.name.split('. ').pop()?.[0]}</span>
                  <div className="min-w-0 flex-1 text-sm">
                    <b className="block truncate">{e.name}</b>
                    <span className="block truncate text-muted-foreground">{e.title} · ★{e.rating}</span>
                    <span className="block truncate text-xs text-muted-foreground">{e.spec.join(', ')} · {e.price.toLocaleString('en-US')}₮</span>
                  </div>
                  <Button size="sm" className="flex-none" onClick={() => openDialog({ kind: 'book', expertId: e.id })}>Цаг захиалах</Button>
                </div>
              ))}
              {actions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {actions.map(a => (
                    <button key={a} onClick={() => runAction(a)}
                      className="rounded-full border border-primary/40 bg-secondary px-3 py-1.5 text-sm font-semibold text-secondary-foreground transition active:scale-95">
                      {CHAT_ACTIONS[a].label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {typing && <div className="typing flex gap-1 self-start rounded-[18px] rounded-bl-md border bg-card px-4 py-3.5" aria-label="Бичиж байна"><i /><i /><i /></div>}
      </div>
      <div className="flex gap-2 overflow-x-auto pt-1.5 no-scrollbar">{QUICK.map(q => <Chip key={q} onClick={() => send(q)}>{q}</Chip>)}</div>
      <form className="flex items-end gap-2 pt-2" onSubmit={e => { e.preventDefault(); void send(text); }}>
        <textarea ref={input} rows={1} placeholder="Мессеж бичих..." aria-label="Мессеж" value={text} maxLength={2000}
          className="max-h-[120px] min-h-12 flex-1 resize-none rounded-xl border-[1.5px] bg-background px-3.5 py-3 focus:border-primary focus:outline-none"
          onChange={e => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
          onKeyDown={e => {
            // Компьютер дээр Enter дарахад илгээнэ, Shift+Enter дарахад шинэ мөрөнд шилжинэ
            if (e.key === 'Enter' && !e.shiftKey && matchMedia('(hover:hover)').matches) { e.preventDefault(); void send(text); }
          }} />
        <Button type="submit" size="xl" className="w-12 flex-none px-0 text-xl" aria-label="Илгээх">➤</Button>
      </form>
      <p className="mt-1.5 text-center text-xs text-muted-foreground">AI туслах нь мэргэжлийн эмчилгээг орлохгүй.</p>
    </div>
  );
}

function Crisis() {
  const { setChatOpen } = useApp();
  return (
    <div role="alert" className="self-stretch rounded-2xl border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
      <b>Та ганцаараа биш 💜</b>
      <p>Таны бичсэн зүйл надад санаа зовоож байна. Яг одоо мэргэжлийн хүнтэй ярилцахыг хүсч байна.</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <a className={buttonVariants({ variant: 'destructive', size: 'xl' })} href="tel:103">📞 103 Түргэн тусламж</a>
        <a className={buttonVariants({ variant: 'destructive', size: 'xl' })} href="tel:108">📞 108 Тусламжийн утас</a>
        <Link className={buttonVariants({ size: 'xl' })} href="/experts" onClick={() => setChatOpen(false)}>Сэтгэл зүйчтэй холбогдох</Link>
      </div>
    </div>
  );
}
