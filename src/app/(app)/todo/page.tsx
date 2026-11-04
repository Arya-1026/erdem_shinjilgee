'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { MoodCalendar } from '@/components/charts';
import { useApp } from '@/components/providers/app-provider';
import { Button, buttonVariants } from '@/components/ui/button';
import { dayAvg } from '@/lib/analytics';
import { WD } from '@/lib/data';
import { TODO_COLS } from '@/lib/db';
import { today as todayStr, weekdayOf } from '@/lib/date';
import { EFFORT, effortLabel, supportHints, TODO_CATEGORIES, weekdayProfile } from '@/lib/todo-plan';
import { cn } from '@/lib/utils';
import type { Todo } from '@/lib/types';

const FIELD = 'min-h-11 w-full min-w-0 rounded-xl border-[1.5px] bg-background px-3 focus:border-primary focus:outline-none';
const dayName = (d: string) => `${d.slice(5).replace('-', '/')} · ${WD[weekdayOf(d)]}`;

export default function TodoPage() {
  const { supabase, todos, setTodos, entries, openDialog } = useApp();
  const [now] = useState(() => new Date());
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [today] = useState(todayStr);
  const [day, setDay] = useState(today);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState('');

  const counts: Record<string, number> = {};
  for (const t of todos) if (t.planned_date && !t.done) counts[t.planned_date] = (counts[t.planned_date] ?? 0) + 1;
  const dayTodos = todos.filter(t => t.planned_date === day);
  const waiting = todos.filter(t => !t.planned_date && !t.done);
  const stats = weekdayProfile(entries, todos.filter(t => t.done));
  const hints = supportHints(todos, stats, today);

  async function plan(replan = false) {
    setBusy(true);
    try {
      const res = await fetch('/api/todos/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, today, replan }) });
      const j: { todos?: Todo[]; summary?: string; error?: string } = await res.json();
      if (!res.ok || !j.todos) throw new Error(j.error);
      setTodos(j.todos);
      setSummary(j.summary ?? '');
      setText('');
    } catch {
      toast.error('Хуваарилж чадсангүй. Дахин оролдоно уу.');
    } finally {
      setBusy(false);
    }
  }

  async function add(t: { title: string; category: string; effort: number; minutes: number; due_date: string | null }) {
    const { data, error } = await supabase.from('todos').insert({ ...t, planned_date: day >= today ? day : today, reason: 'Та өөрөө энэ өдөрт нэмсэн.' }).select(TODO_COLS).single<Todo>();
    if (error || !data) return void toast.error('Нэмж чадсангүй');
    setTodos(l => [...l, data]);
  }

  async function toggle(t: Todo) {
    const patch = { done: !t.done, done_at: t.done ? null : new Date().toISOString() };
    setTodos(l => l.map(x => (x.id === t.id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from('todos').update(patch).eq('id', t.id);
    if (error) { setTodos(l => l.map(x => (x.id === t.id ? t : x))); toast.error('Хадгалж чадсангүй'); }
  }

  async function remove(t: Todo) {
    setTodos(l => l.filter(x => x.id !== t.id));
    const { error } = await supabase.from('todos').delete().eq('id', t.id);
    if (error) { setTodos(l => [...l, t]); toast.error('Устгаж чадсангүй'); }
  }

  const shift = (d: number) => setMonth(({ y, m }) => { const x = new Date(y, m + d, 1); return { y: x.getFullYear(), m: x.getMonth() }; });

  return (
    <div className="grid gap-4 desk:grid-cols-[3fr_2fr] desk:items-start">
      <aside className="card-x flex flex-col gap-2.5 desk:sticky desk:top-[calc(var(--head-h)+12px)] desk:order-2">
        <h2 className="font-bold">🤖 AI туслах</h2>
        <p className="text-sm text-muted-foreground">Хийх ажлаа чөлөөтэй бичээрэй. Таны сэтгэл санаа, эрч хүч, дуусгасан ажлын түүхэд тулгуурлан хамгийн тохирох өдөрт байрлуулна.</p>
        <label htmlFor="todo-ai" className="sr-only">Хийх ажлууд</label>
        <textarea id="todo-ai" rows={4} value={text} onChange={e => setText(e.target.value)} maxLength={2000}
          placeholder="Жишээ нь: Баасан гараг гэхэд тайлангаа дуусгах, өрөөгөө цэвэрлэх, 3 удаа гүйх"
          className="w-full resize-y rounded-xl border-[1.5px] bg-background px-3 py-2.5 focus:border-primary focus:outline-none" />
        <Button size="xl" className="w-full" disabled={busy || (!text.trim() && !waiting.length)} onClick={() => void plan()}>{busy ? 'Хуваарилж байна…' : '✨ Календарьт хуваарилах'}</Button>
        {todos.some(t => !t.done) && <Button size="xl" variant="outline" className="w-full" disabled={busy} onClick={() => void plan(true)}>↻ Бүх ажлыг дахин хуваарилах</Button>}
        {summary && <p className="rounded-xl bg-secondary p-3 text-sm" aria-live="polite">{summary}</p>}
        {waiting.length > 0 && <p className="text-xs text-muted-foreground">{waiting.length} ажил хуваарилагдаагүй байна.</p>}
      </aside>

      <div className="flex min-w-0 flex-col gap-4">
        {hints.slice(0, 2).map(h => (
          <section key={h.date} className="card-x grad-dawn border-0">
            <h3 className="mb-1 font-semibold">Урьдчилан бэлдье 💜</h3>
            <p className="mb-2.5 text-sm">{h.text}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="xl" className="h-10" onClick={() => openDialog({ kind: 'breath' })}>🫁 Амьсгалын дасгал</Button>
              <Link href="/experts" className={cn(buttonVariants({ variant: 'outline', size: 'xl' }), 'h-10')}>Сэтгэл зүйчтэй ярих</Link>
            </div>
          </section>
        ))}

        <section className="card-x">
          <div className="mb-2 flex items-center justify-between gap-2">
            <button className="grid size-10 place-items-center rounded-full border text-xl" aria-label="Өмнөх сар" onClick={() => shift(-1)}>‹</button>
            <h2 className="font-bold">{month.y} оны {month.m + 1}-р сар</h2>
            <button className="grid size-10 place-items-center rounded-full border text-xl" aria-label="Дараагийн сар" onClick={() => shift(1)}>›</button>
          </div>
          <MoodCalendar year={month.y} month={month.m} today={today} avgOf={d => dayAvg(entries, d)} counts={counts} selected={day} onPick={setDay} />
        </section>

        <section className="card-x">
          <h2 className="mb-1 font-bold">{day === today ? 'Өнөөдөр' : dayName(day)}</h2>
          {dayTodos.length ? dayTodos.map(t => <TodoRow key={t.id} t={t} onToggle={toggle} onRemove={remove} />) : <p className="text-sm text-muted-foreground">Энэ өдөр ажил алга.</p>}
          <AddTodo onAdd={add} />
        </section>
      </div>
    </div>
  );
}

function TodoRow({ t, onToggle, onRemove }: { t: Todo; onToggle: (t: Todo) => void; onRemove: (t: Todo) => void }) {
  return (
    <div className="border-b py-2.5 last:border-0">
      <div className="flex items-start gap-2.5">
        <input type="checkbox" className="mt-0.5 size-6 flex-none accent-primary" checked={t.done} onChange={() => onToggle(t)} aria-label={`${t.title} дууссан`} />
        <div className="min-w-0 flex-1">
          <b className={cn('block [overflow-wrap:anywhere]', t.done && 'text-muted-foreground line-through')}>{t.title}</b>
          <span className="text-xs text-muted-foreground">{t.category} · {effortLabel(t.effort)} · {t.minutes} мин{t.due_date && ` · эцсийн хугацаа ${t.due_date.slice(5).replace('-', '/')}`}</span>
        </div>
        <button className="grid size-9 flex-none place-items-center rounded-lg text-muted-foreground" aria-label={`${t.title} устгах`} onClick={() => onRemove(t)}>✕</button>
      </div>
      {t.reason && (
        <details className="mt-1.5 ml-[34px] text-sm">
          <summary className="cursor-pointer font-semibold text-primary">Яагаад энэ өдөр вэ?</summary>
          <p className="mt-1 text-muted-foreground">{t.reason}</p>
        </details>
      )}
    </div>
  );
}

function AddTodo({ onAdd }: { onAdd: (t: { title: string; category: string; effort: number; minutes: number; due_date: string | null }) => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(TODO_CATEGORIES[0]);
  const [effort, setEffort] = useState(2);
  const [minutes, setMinutes] = useState(30);
  const [due, setDue] = useState('');
  return (
    <form className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4" onSubmit={e => {
      e.preventDefault();
      if (!title.trim()) return;
      void onAdd({ title: title.trim(), category, effort, minutes: Math.min(600, Math.max(5, minutes || 30)), due_date: due || null });
      setTitle(''); setDue('');
    }}>
      <input className={cn(FIELD, 'col-span-2 sm:col-span-4')} placeholder="Шинэ ажил нэмэх" aria-label="Ажлын нэр" value={title} maxLength={200} onChange={e => setTitle(e.target.value)} />
      <select className={FIELD} aria-label="Ангилал" value={category} onChange={e => setCategory(e.target.value)}>{TODO_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
      <select className={FIELD} aria-label="Хүндрэл" value={effort} onChange={e => setEffort(+e.target.value)}>{EFFORT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <input className={FIELD} type="number" min={5} max={600} step={5} aria-label="Хугацаа, минут" value={minutes} onChange={e => setMinutes(+e.target.value)} />
      <input className={FIELD} type="date" aria-label="Эцсийн хугацаа" value={due} onChange={e => setDue(e.target.value)} />
      <Button type="submit" size="xl" variant="secondary" className="col-span-2 sm:col-span-4">＋ Нэмэх</Button>
    </form>
  );
}
