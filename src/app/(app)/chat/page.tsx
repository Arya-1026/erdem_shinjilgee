'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useApp } from '@/components/providers/app-provider';
import { ytTrack } from '@/components/providers/player-provider';
import { usePlay } from '@/components/use-play';
import { Chip, Segmented } from '@/components/segmented';
import { Button, buttonVariants } from '@/components/ui/button';
import { todaysEntries } from '@/lib/analytics';
import { greeting } from '@/lib/chat-fallback';
import { CHAT_ACTIONS, splitActions, type ChatAction } from '@/lib/chat-prompt';
import { QUICK, moodById } from '@/lib/data';
import { cn } from '@/lib/utils';
import type { ChatMessage, ChatMode, SongRec } from '@/lib/types';

const MODES: [ChatMode, string][] = [['calm', '🌊 Тайвшруулах'], ['motivate', '💪 Урам өгөх'], ['listen', '👂 Сонсох']];

export default function ChatPage() {
  const { supabase, profile, entries, updateProfile, openDialog, activeMood } = useApp();
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

  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [msgs, typing]);

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
    if (a === 'experts') return router.push('/experts');
    if (a === 'music') return void play.mood(activeMood.id);
    if (a === 'ambient') {
      fetch(`/api/music/recs?mood=${activeMood.id}&kind=ambient`).then(r => r.json())
        .then((j: { recs?: SongRec[] }) => j.recs?.length ? play.list(j.recs.map(r => ytTrack(r, activeMood.id)), 0) : play.mood(activeMood.id))
        .catch(() => play.mood(activeMood.id));
    }
  }

  const todayMood = todaysEntries(entries)[0];
  const hello: ChatMessage = { id: 'hello', role: 'assistant', crisis: false, content: greeting(profile.name, todayMood && moodById(todayMood.mood).label) };

  return (
    <div className="chat flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented label="Хариултын горим" value={profile.chat_mode} onChange={v => updateProfile({ chat_mode: v })} options={MODES} />
        <button className="text-sm text-muted-foreground" onClick={clear}>Цэвэрлэх</button>
      </div>
      <div ref={box} className="flex flex-1 flex-col gap-2.5 overflow-y-auto overscroll-contain px-0.5 py-3" aria-live="polite">
        {msgs && [hello, ...msgs].map(m => {
          if (m.crisis) return <Crisis key={m.id} />;
          const { text, actions } = m.role === 'assistant' ? splitActions(m.content) : { text: m.content, actions: [] };
          return (
            <div key={m.id} className={cn('flex max-w-[88%] flex-col gap-1.5 desk:max-w-[65%]', m.role === 'user' ? 'self-end items-end' : 'self-start items-start')}>
              <div className={cn('rounded-[18px] px-3.5 py-2.5 whitespace-pre-wrap [overflow-wrap:anywhere]',
                m.role === 'user' ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md border bg-card')}>{text}</div>
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
  return (
    <div role="alert" className="self-stretch rounded-2xl border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">
      <b>Та ганцаараа биш 💜</b>
      <p>Таны бичсэн зүйл надад санаа зовоож байна. Яг одоо мэргэжлийн хүнтэй ярилцахыг хүсч байна.</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <a className={buttonVariants({ variant: 'destructive', size: 'xl' })} href="tel:103">📞 103 Түргэн тусламж</a>
        <a className={buttonVariants({ variant: 'destructive', size: 'xl' })} href="tel:108">📞 108 Тусламжийн утас</a>
        <Link className={buttonVariants({ size: 'xl' })} href="/experts">Сэтгэл зүйчтэй холбогдох</Link>
      </div>
    </div>
  );
}
