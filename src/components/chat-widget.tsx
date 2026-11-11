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
import { crisisReminderKind } from '@/lib/crisis';
import { QUICK, moodById } from '@/lib/data';
import { cn } from '@/lib/utils';
import type { ChatMessage, ChatMode, MoodId, SongRec } from '@/lib/types';
import { useMovieRecs } from './use-movies';
import { useT } from '@/components/providers/locale-provider';
import { stopVoice, VoiceInput } from '@/components/voice-input';

const MODES: [ChatMode, string][] = [['calm', '🌊 Тайван'], ['motivate', '💪 Урам'], ['listen', '👂 Сонсох']];

/* Хөвөгч чат: аль ч хуудаснаас хүрч болох товч ба самбар. Хоёуланг нь чирч дөрвөн булангийн аль нэгэнд тавина, цэс, тоглуулагчийг дардаггүй. */
export function ChatWidget() {
  const tr = useT();
  const { chatOpen, setChatOpen } = useApp();
  const [opened, setOpened] = useState(false); // Анх нээх хүртэл мессеж татахгүй
  if (chatOpen && !opened) setOpened(true);
  const [bubble, bubbleDrag] = useDrag('chat-bubble', !chatOpen, 'corners');
  const [panel, panelDrag] = useDrag('chat-panel', chatOpen, 'corners');
  const down = useRef({ x: 0, y: 0 });

  return (
    <>
      <div ref={bubble} className={cn('chat-bubble no-print fixed z-34', chatOpen && 'hidden')}>
        <button type="button" aria-label={tr('AI туслах нээх')} title={tr('AI туслах (чирж зөөнө)')} {...bubbleDrag}
          className="grid size-14 touch-none place-items-center rounded-full bg-primary text-2xl text-primary-foreground shadow-[0_8px_24px_rgba(0,0,0,.3)] transition-transform active:scale-95"
          onPointerDown={e => { down.current = { x: e.clientX, y: e.clientY }; bubbleDrag.onPointerDown(e); }}
          // Чирсний дараа click бас ирдэг: бага хөдөлсөн үед л нээнэ
          onClick={e => { if (Math.hypot(e.clientX - down.current.x, e.clientY - down.current.y) < 6) setChatOpen(true); }}>
          💬
        </button>
      </div>
      <section ref={panel} role="dialog" aria-label={tr('AI туслах')} className={cn('chat-panel no-print fixed z-34 flex flex-col overflow-hidden rounded-2xl border bg-background shadow-[0_12px_40px_rgba(0,0,0,.3)]', !chatOpen && 'hidden')}>
        <header className="flex flex-none items-center gap-1 border-b bg-card pr-1.5">
          <div {...panelDrag} className="flex min-w-0 flex-1 cursor-grab touch-none items-center gap-2 py-3 pl-3.5 font-bold select-none active:cursor-grabbing" title={tr('Чирж зөөх')}>
            {tr('💬 AI туслах')}{' '}<i className="h-1 w-8 rounded-full bg-border" aria-hidden="true" />
          </div>
          <button type="button" className="grid size-10 flex-none place-items-center rounded-full text-lg" aria-label={tr('Хураах')} onClick={() => setChatOpen(false)}>⌄</button>
        </header>
        {opened && <ChatBody />}
      </section>
    </>
  );
}

function ChatBody() {
  const tr = useT();
  const { supabase, profile, entries, updateProfile, openDialog, activeMood, experts, chatOpen, setChatOpen } = useApp();
  const play = usePlay();
  const router = useRouter();
  const [msgs, setMsgs] = useState<ChatMessage[] | null>(null);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [heard, setHeard] = useState(''); // дуугаар бичих үеийн түр текст
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.from('chat_messages').select('id,role,content,crisis').order('created_at').limit(60)
      .then(({ data }) => setMsgs((data as ChatMessage[]) ?? []));
  }, [supabase]);

  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [msgs, typing, chatOpen]);

  async function send(raw: string) {
    stopVoice();
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
      toast.error(tr('Мессеж илгээгдсэнгүй. Дахин оролдоно уу.'));
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
  // mood: дуу, киног аль сэтгэл санаанд тааруулах (хямралын үед «гунигтай», бусад үед сүүлийн бүртгэл)
  function runAction(a: ChatAction, mood: MoodId = activeMood.id) {
    const EX: Partial<Record<ChatAction, string>> = { grounding: 'e2', walk: 'e3', journal: 'e5', relax: 'e6', plan: 'e9', partner: 'e10' };
    if (a === 'breath') return openDialog({ kind: 'breath' });
    if (EX[a]) return openDialog({ kind: 'exercise', recId: EX[a]! });
    if (a === 'experts') { setChatOpen(false); return router.push('/experts'); }
    if (a === 'music') return void play.mood(mood);
    if (a === 'ambient') {
      fetch(`/api/music/recs?mood=${mood}&kind=ambient`).then(r => r.json())
        .then((j: { recs?: SongRec[] }) => j.recs?.length ? play.list(j.recs.map(r => songTrack(r, mood)), 0) : play.mood(mood))
        .catch(() => play.mood(mood));
    }
  }

  // AI-ийн санал болгосон дасгал, дуу, кино: товч бүр нэг товшилтоор нээгдэнэ. Кино товч дээр тохирох киноны нэр гарна.
  const actionButtons = (actions: ChatAction[], mood: MoodId = activeMood.id) => actions.length > 0 && (
    // max-w-full: киноны урт нэр чатын өргөнөөс хэтэрч хэвтээ гүйлгэх зурвас гаргахгүй (товч дотроо «…» болж тасарна)
    <div className="flex max-w-full flex-wrap gap-1.5">
      {actions.map(a => a === 'movie_rec'
        ? <MovieAction key={a} mood={mood} className={ACTION_BTN} />
        : <button key={a} onClick={() => runAction(a, mood)} className={ACTION_BTN}>{tr(CHAT_ACTIONS[a].label)}</button>)}
    </div>
  );

  const todayMood = todaysEntries(entries)[0];
  const hello: ChatMessage = { id: 'hello', role: 'assistant', crisis: false, content: greeting(profile.name, todayMood && tr(moodById(todayMood.mood).label), tr) };

  return (
    <div className="flex min-h-0 flex-1 flex-col px-3 pt-2 pb-2">
      <Segmented full label={tr('Хариултын горим')} className="text-xs" value={profile.chat_mode} onChange={v => updateProfile({ chat_mode: v })} options={MODES.map(([v, l]) => [v, tr(l)])} />
      <button className="mt-1 self-end text-xs text-muted-foreground" onClick={clear}>{tr('Цэвэрлэх')}</button>
      <div ref={box} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-0.5 py-2" aria-live="polite">
        {msgs && [hello, ...msgs].map((m, i, all) => {
          // Хямрал: эхлээд AI-ийн товч хариулт, доор нь тусламжийн сануулга (саяхан бүтэн карт гарсан бол жижиг хувилбар).
          // Хуучин хоосон хямралын мөрөнд зөвхөн карт.
          // Дараалал: хариулт → дасгал, ая, кино → тусламжийн утас
          if (m.crisis) {
            const c = splitActions(m.content);
            return (
              <div key={m.id} className="flex flex-col items-start gap-1.5 self-stretch">
                {c.text.trim() && <div className="max-w-[90%] rounded-[18px] rounded-bl-md border bg-card px-3.5 py-2.5 whitespace-pre-wrap [overflow-wrap:anywhere]">{c.text}</div>}
                {actionButtons(c.actions, 'sad')}
                <Crisis compact={crisisReminderKind(all, i) === 'compact'} />
              </div>
            );
          }
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
                    <span className="block truncate text-muted-foreground">{tr(e.title)} · ★{e.rating}</span>
                    <span className="block truncate text-xs text-muted-foreground">{e.spec.map(s => tr(s)).join(', ')} · {e.price.toLocaleString('en-US')}₮</span>
                  </div>
                  <Button size="sm" className="flex-none" onClick={() => openDialog({ kind: 'book', expertId: e.id })}>{tr('Цаг захиалах')}</Button>
                </div>
              ))}
              {actionButtons(actions)}
            </div>
          );
        })}
        {typing && <div className="typing flex gap-1 self-start rounded-[18px] rounded-bl-md border bg-card px-4 py-3.5" aria-label={tr('Бичиж байна')}><i /><i /><i /></div>}
      </div>
      <div className="flex gap-2 overflow-x-auto pt-1.5 no-scrollbar">{QUICK.map(q => <Chip key={q} onClick={() => send(tr(q))}>{tr(q)}</Chip>)}</div>
      <form className="flex items-end gap-2 pt-2" onSubmit={e => { e.preventDefault(); void send(text); }}>
        <textarea ref={input} rows={1} placeholder={heard || tr('Мессеж бичих...')} aria-label={tr('Мессеж')} value={text} maxLength={2000}
          className="max-h-[120px] min-h-12 flex-1 resize-none rounded-xl border-[1.5px] bg-background px-3.5 py-3 focus:border-primary focus:outline-none"
          onChange={e => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
          onKeyDown={e => {
            // Компьютер дээр Enter дарахад илгээнэ, Shift+Enter дарахад шинэ мөрөнд шилжинэ
            if (e.key === 'Enter' && !e.shiftKey && matchMedia('(hover:hover)').matches) { e.preventDefault(); void send(text); }
          }} />
        {/* Ярьсныг текст болгож мессежид нэмнэ, илгээхээсээ өмнө засаж болно */}
        <VoiceInput compact onInterim={setHeard} onText={t => setText(v => (v.trim() ? `${v.trimEnd()} ${t}` : t).slice(0, 2000))} />
        <Button type="submit" size="xl" className="w-12 flex-none px-0 text-xl" aria-label={tr('Илгээх')}>➤</Button>
      </form>
      <p className="mt-1.5 text-center text-xs text-muted-foreground">{tr('AI туслах нь мэргэжлийн эмчилгээг орлохгүй.')}</p>
    </div>
  );
}

const ACTION_BTN = 'rounded-full border border-primary/40 bg-secondary px-3 py-1.5 text-sm font-semibold text-secondary-foreground transition active:scale-95';

/** Хэрэглэгчийн хобби, сэтгэл санаанд тохирох нэг кино. Каталог зөвхөн энэ товч гарсан үед ачаалагдана. */
function MovieAction({ mood, className }: { mood: MoodId; className: string }) {
  const tr = useT();
  const { openDialog } = useApp();
  const { recs } = useMovieRecs(mood, 3);
  const r = recs?.[0];
  return (
    <button type="button" className={cn(className, 'max-w-full truncate')} disabled={!r} onClick={() => r && openDialog({ kind: 'movie', recId: r.id, mood })}>
      {r ? `🎬 ${tr(r.title)}` : tr(CHAT_ACTIONS.movie_rec.label)}
    </button>
  );
}

function Crisis({ compact }: { compact: boolean }) {
  const tr = useT();
  const { setChatOpen } = useApp();
  // Дахин илэрсэн үед: ярилцлагыг дарахгүй жижиг сануулга, гэхдээ тусламжийн утас үргэлж нэг товшилтын зайд
  if (compact) return (
    <div role="note" className="flex flex-wrap items-center gap-1.5 self-stretch rounded-xl border border-red-200 bg-red-50/70 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
      <span className="mr-0.5">{tr('💜 Хэцүү байвал одоо залгаарай:')}</span>
      <a className={buttonVariants({ variant: 'destructive', size: 'sm' })} href="tel:108">📞 108</a>
      <a className={buttonVariants({ variant: 'destructive', size: 'sm' })} href="tel:103">📞 103</a>
      <Link className={buttonVariants({ size: 'sm', variant: 'outline' })} href="/experts" onClick={() => setChatOpen(false)}>{tr('Сэтгэл зүйч')}</Link>
    </div>
  );
  return (
    <div role="alert" className="self-stretch rounded-2xl border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
      <b>{tr('Та ганцаараа биш 💜')}</b>
      <p>{tr('Таны бичсэн зүйл надад санаа зовоож байна. Яг одоо мэргэжлийн хүнтэй ярилцахыг хүсч байна.')}</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <a className={buttonVariants({ variant: 'destructive', size: 'xl' })} href="tel:103">{tr('📞 103 Түргэн тусламж')}</a>
        <a className={buttonVariants({ variant: 'destructive', size: 'xl' })} href="tel:108">{tr('📞 108 Тусламжийн утас')}</a>
        <Link className={buttonVariants({ size: 'xl' })} href="/experts" onClick={() => setChatOpen(false)}>{tr('Сэтгэл зүйчтэй холбогдох')}</Link>
      </div>
    </div>
  );
}
