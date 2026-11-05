'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { type CalendarMark, MoodCalendar } from '@/components/charts';
import { useApp } from '@/components/providers/app-provider';
import { Button, buttonVariants } from '@/components/ui/button';
import { dayAvg } from '@/lib/analytics';
import { WD } from '@/lib/data';
import { TODO_COLS } from '@/lib/db';
import { today as todayStr, weekdayOf } from '@/lib/date';
import { EFFORT, effortLabel, FIXED, hhmm, supportHints, TODO_CATEGORIES, TODO_EMOJIS, weekdayProfile } from '@/lib/todo-plan';
import { cn } from '@/lib/utils';
import type { Todo } from '@/lib/types';

const FIELD = 'min-h-11 w-full min-w-0 rounded-xl border-[1.5px] bg-background px-3 focus:border-primary focus:outline-none';
const dayName = (d: string) => `${d.slice(5).replace('-', '/')} · ${WD[weekdayOf(d)]}`;
// Цагтай ажил эхэнд, цагаар нь эрэмбэлнэ
const byTime = (a: Todo, b: Todo) => (a.planned_time ?? '99').localeCompare(b.planned_time ?? '99');
type NewTodo = { title: string; category: string; effort: number; minutes: number; due_date: string | null; planned_time: string | null; emoji: string | null };

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
  const [editing, setEditing] = useState<string | null>(null);

  // 🔥 Сэтгэл санаагаа бүртгэсэн (идэвхтэй байсан) өдрүүд
  const activeDays = new Set(entries.map(e => e.entry_date));
  const marks: Record<string, CalendarMark[]> = {};
  for (const t of [...todos].sort(byTime)) {
    if (!t.planned_date) continue;
    if (!t.done) counts[t.planned_date] = (counts[t.planned_date] ?? 0) + 1;
    // Эможигүй ажил 📌-ээр харагдана (Тайлан хуудастай адил)
    (marks[t.planned_date] ??= []).push({ id: t.id, emoji: t.emoji ?? '📌', title: [hhmm(t.planned_time), t.title].filter(Boolean).join(' · ') });
  }
  const dayTodos = todos.filter(t => t.planned_date === day).sort(byTime);
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

  async function add(t: NewTodo) {
    const { data, error } = await supabase.from('todos').insert({ ...t, planned_date: day >= today ? day : today, reason: `${FIXED}Та өөрөө энэ өдөрт нэмсэн.` }).select(TODO_COLS).single<Todo>();
    if (error || !data) return void toast.error('Нэмж чадсангүй');
    setTodos(l => [...l, data]);
  }

  async function toggle(t: Todo) {
    const patch = { done: !t.done, done_at: t.done ? null : new Date().toISOString() };
    setTodos(l => l.map(x => (x.id === t.id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from('todos').update(patch).eq('id', t.id);
    if (error) { setTodos(l => l.map(x => (x.id === t.id ? t : x))); toast.error('Хадгалж чадсангүй'); }
  }

  async function save(t: Todo, patch: NewTodo & { planned_date: string }) {
    setEditing(null);
    setTodos(l => l.map(x => (x.id === t.id ? { ...x, ...patch } : x)));
    const { error } = await supabase.from('todos').update(patch).eq('id', t.id);
    if (error) { setTodos(l => l.map(x => (x.id === t.id ? t : x))); toast.error('Хадгалж чадсангүй'); }
  }

  // Календарийн эможи дээр дарахад тухайн ажлыг засах горимд нээнэ
  function editFromCalendar(id: string) {
    const t = todos.find(x => x.id === id);
    if (!t?.planned_date) return;
    setDay(t.planned_date);
    setEditing(id);
    requestAnimationFrame(() => document.getElementById(`todo-${id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
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
          <MoodCalendar year={month.y} month={month.m} today={today} avgOf={d => dayAvg(entries, d)} counts={counts} marks={marks} fire={activeDays} selected={day} onPick={setDay} onMark={editFromCalendar} />
        </section>

        <section className="card-x">
          <h2 className="mb-1 font-bold">{day === today ? 'Өнөөдөр' : dayName(day)}</h2>
          {dayTodos.length ? dayTodos.map(t => editing === t.id
            ? <div key={t.id} id={`todo-${t.id}`} className="border-b py-2.5 last:border-0"><TodoForm initial={t} submitLabel="✓ Хадгалах" onSubmit={p => save(t, { ...p, planned_date: p.planned_date ?? t.planned_date ?? day })} onCancel={() => setEditing(null)} /></div>
            : <TodoRow key={t.id} t={t} onToggle={toggle} onRemove={remove} onEdit={() => setEditing(t.id)} />)
            : <p className="text-sm text-muted-foreground">Энэ өдөр ажил алга.</p>}
          <TodoForm submitLabel="＋ Нэмэх" onSubmit={add} />
        </section>
      </div>
    </div>
  );
}

function TodoRow({ t, onToggle, onRemove, onEdit }: { t: Todo; onToggle: (t: Todo) => void; onRemove: (t: Todo) => void; onEdit: () => void }) {
  return (
    <div id={`todo-${t.id}`} className="border-b py-2.5 last:border-0">
      <div className="flex items-start gap-2.5">
        <input type="checkbox" className="mt-0.5 size-6 flex-none accent-primary" checked={t.done} onChange={() => onToggle(t)} aria-label={`${t.title} дууссан`} />
        <button className="min-w-0 flex-1 rounded-lg text-left hover:bg-secondary/60" title="Дарж засах" aria-label={`${t.title} засах`} onClick={onEdit}>
          <b className={cn('block [overflow-wrap:anywhere]', t.done && 'text-muted-foreground line-through')}>{t.emoji && <span className="mr-1.5" aria-hidden>{t.emoji}</span>}{t.title}</b>
          <span className="text-xs text-muted-foreground">{t.planned_time && <b className="text-foreground">{hhmm(t.planned_time)} · </b>}{t.category} · {effortLabel(t.effort)} · {t.minutes} мин{t.due_date && ` · эцсийн хугацаа ${t.due_date.slice(5).replace('-', '/')}`}</span>
        </button>
        <button className="grid size-9 flex-none place-items-center rounded-lg text-muted-foreground" aria-label={`${t.title} засах`} title="Засах" onClick={onEdit}>✎</button>
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

// Шинэ ажил нэмэх, эсвэл initial өгвөл тухайн ажлыг засах форм
function TodoForm({ initial, submitLabel, onSubmit, onCancel }: { initial?: Todo; submitLabel: string; onSubmit: (t: NewTodo & { planned_date?: string }) => Promise<void>; onCancel?: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [category, setCategory] = useState(initial?.category ?? TODO_CATEGORIES[0]);
  const [effort, setEffort] = useState(initial?.effort ?? 2);
  const [minutes, setMinutes] = useState(initial?.minutes ?? 30);
  const [due, setDue] = useState(initial?.due_date ?? '');
  const [time, setTime] = useState(hhmm(initial?.planned_time ?? null));
  const [emoji, setEmoji] = useState(initial?.emoji ?? '');
  const [date, setDate] = useState(initial?.planned_date ?? '');
  return (
    <form className={cn('grid grid-cols-2 gap-2 sm:grid-cols-4', !initial && 'mt-3')} onSubmit={e => {
      e.preventDefault();
      if (!title.trim()) return;
      void onSubmit({ title: title.trim(), category, effort, minutes: Math.min(600, Math.max(5, minutes || 30)), due_date: due || null, planned_time: time || null, emoji: emoji || null, ...(initial && date ? { planned_date: date } : {}) });
      if (!initial) { setTitle(''); setDue(''); setTime(''); setEmoji(''); }
    }}>
      <input className={cn(FIELD, 'col-span-2 sm:col-span-4')} placeholder="Шинэ ажил нэмэх" aria-label="Ажлын нэр" value={title} maxLength={200} onChange={e => setTitle(e.target.value)} autoFocus={!!initial} />
      <div className="col-span-2 flex flex-wrap gap-1.5 sm:col-span-4" role="group" aria-label="Эможи">
        {TODO_EMOJIS.map(em => (
          <button key={em} type="button" aria-pressed={emoji === em} aria-label={`Эможи ${em}`} onClick={() => setEmoji(v => (v === em ? '' : em))}
            className={cn('grid size-10 place-items-center rounded-xl border-[1.5px] text-xl', emoji === em ? 'border-primary bg-secondary' : 'bg-background')}>{em}</button>
        ))}
      </div>
      <select className={FIELD} aria-label="Ангилал" value={category} onChange={e => setCategory(e.target.value)}>{TODO_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select>
      <select className={FIELD} aria-label="Хүндрэл" value={effort} onChange={e => setEffort(+e.target.value)}>{EFFORT.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <input className={FIELD} type="number" min={5} max={600} step={5} aria-label="Хугацаа, минут" value={minutes} onChange={e => setMinutes(+e.target.value)} />
      <input className={FIELD} type="time" aria-label="Эхлэх цаг" title="Эхлэх цаг" value={time} onChange={e => setTime(e.target.value)} />
      <label className="col-span-2 flex items-center gap-2 text-sm text-muted-foreground sm:col-span-4">
        <span className="flex-none">Эцсийн хугацаа</span>
        <input className={FIELD} type="date" value={due} onChange={e => setDue(e.target.value)} />
      </label>
      {initial && (
        <label className="col-span-2 flex items-center gap-2 text-sm text-muted-foreground sm:col-span-4">
          <span className="flex-none">Хийх өдөр</span>
          <input className={FIELD} type="date" value={date} onChange={e => setDate(e.target.value)} />
        </label>
      )}
      <Button type="submit" size="xl" variant={initial ? 'default' : 'secondary'} className={cn('col-span-2', initial ? 'sm:col-span-2' : 'sm:col-span-4')}>{submitLabel}</Button>
      {onCancel && <Button type="button" size="xl" variant="outline" className="col-span-2 sm:col-span-2" onClick={onCancel}>Болих</Button>}
    </form>
  );
}
