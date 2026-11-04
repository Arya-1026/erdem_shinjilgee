'use client';

import Link from 'next/link';
import { useState } from 'react';
import { type CalendarMark, DailyChart, MoodCalendar, WeekdayChart, type DayPoint } from '@/components/charts';
import { MoodFace } from '@/components/mood-face';
import { useApp } from '@/components/providers/app-provider';
import { SeasonalCorner } from '@/components/seasonal';
import { Segmented } from '@/components/segmented';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { dayAvg, insights, mean, prediction, scoreLevel, streak, weekdayStats } from '@/lib/analytics';
import { MOODS, WD, WD_SHORT, moodById } from '@/lib/data';
import { addDays, today, ymd } from '@/lib/date';
import { cn } from '@/lib/utils';
import type { Todo } from '@/lib/types';

export default function StatsPage() {
  const { profile, entries, todos } = useApp();
  const planned: Record<string, number> = {};
  // Календарийн нүдэнд ажлын эможи, нэр харагдана (эможигүй ажил 📌-ээр)
  // 🔥 Сэтгэл санаагаа бүртгэсэн (идэвхтэй байсан) өдрүүд
  const activeDays = new Set(entries.map(e => e.entry_date));
  const marks: Record<string, CalendarMark[]> = {};
  for (const t of [...todos].sort(byTime)) {
    if (!t.planned_date) continue;
    if (!t.done) planned[t.planned_date] = (planned[t.planned_date] ?? 0) + 1;
    (marks[t.planned_date] ??= []).push({ id: t.id, emoji: t.emoji ?? '📌', title: [t.planned_time?.slice(0, 5), t.title].filter(Boolean).join(' · ') });
  }
  const [range, setRange] = useState<7 | 30>(7);
  const [now] = useState(() => new Date());
  const [sel, setSel] = useState<string | null>(null);

  const days = [...Array(range)].map((_, i) => addDays(now, i - range + 1));
  const series: DayPoint[] = days.map((d, i) => ({
    label: range === 7 ? WD_SHORT[d.getDay()] : i % 5 === 0 || i === days.length - 1 ? String(d.getDate()) : '',
    title: `${d.getMonth() + 1}/${d.getDate()} · ${WD[d.getDay()]}`,
    v: dayAvg(entries, ymd(d)),
  }));
  const logged = series.filter(p => p.v != null);
  const avg = mean(logged.map(p => p.v!));
  const rangeE = entries.filter(e => e.entry_date >= ymd(days[0]));
  const counts: Record<string, number> = {}; rangeE.forEach(e => (counts[e.mood] = (counts[e.mood] || 0) + 1));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const ws = weekdayStats(entries), valid = ws.filter(x => x.avg != null);
  const lowest = valid.length ? valid.reduce((a, b) => (b.avg! < a.avg! ? b : a)) : null;
  const highest = valid.length ? valid.reduce((a, b) => (b.avg! > a.avg! ? b : a)) : null;
  const p = prediction(entries, profile.hobbies[0]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented value={range} onChange={setRange} options={[[7, '7 хоног'], [30, '30 хоног']]} />
        <Button variant="outline" size="xl" className="h-10" onClick={() => print()}>⬇ PDF тайлан</Button>
      </div>

      <div className="my-3.5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Дундаж оноо">{avg ? avg.toFixed(1) : '–'}<small className="text-muted-foreground"> / 5</small></Tile>
        <Tile label="Бүртгэсэн өдөр">{logged.length}<small className="text-muted-foreground"> / {range}</small></Tile>
        <Tile label="Дараалсан өдөр">🔥 {streak(entries)}</Tile>
        <Tile label="Их давтагдсан">{top ? `${moodById(top[0]).emoji} ${moodById(top[0]).label}` : '–'}</Tile>
      </div>

      <div className="grid gap-4 desk:grid-cols-2 desk:items-start">
        <section className="card-x relative">
          <SeasonalCorner />
          <h3 className="font-semibold">Өдөр тутмын сэтгэл санаа</h3>
          <DailyChart data={series} />
          <details className="mt-2 text-sm">
            <summary className="cursor-pointer text-muted-foreground">Хүснэгтээр харах</summary>
            <table className="mt-2 w-full text-left">
              <thead><tr className="text-muted-foreground"><th className="font-medium">Өдөр</th><th className="font-medium">Дундаж</th></tr></thead>
              <tbody>{series.map(r => <tr key={r.title} className="border-t"><td className="py-1">{r.title}</td><td>{r.v == null ? '–' : r.v.toFixed(1)}</td></tr>)}</tbody>
            </table>
          </details>
        </section>

        <section className="card-x relative">
          <SeasonalCorner items={['🎁', '⭐']} />
          <h3 className="font-semibold">Гаригийн хэв маяг</h3>
          <WeekdayChart stats={ws} />
          {lowest && highest && valid.length >= 3 && (
            <p className="mt-3 text-sm">📉 <b>{WD[lowest.w]}</b> гарагт хамгийн доогуур ({lowest.avg!.toFixed(1)}), 📈 <b>{WD[highest.w]}</b> гарагт хамгийн өндөр ({highest.avg!.toFixed(1)}) байдаг.</p>
          )}
        </section>

        <section className="card-x relative">
          <SeasonalCorner items={['☕', '🍪']} />
          <h3 className="mb-1 font-semibold">Сэтгэл хөдлөлийн тархалт</h3>
          {MOODS.map(m => {
            const pct = rangeE.length ? Math.round(((counts[m.id] || 0) / rangeE.length) * 100) : 0;
            return (
              <div key={m.id} className="my-2 flex items-center gap-2.5">
                <MoodFace m={m} className="size-7 text-[1.3rem]" />
                <span className="w-20 text-sm">{m.label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-background"><i className="block h-full rounded-full" style={{ width: `${pct}%`, background: m.color }} /></div>
                <span className="w-9 text-right text-sm text-muted-foreground">{pct}%</span>
              </div>
            );
          })}
        </section>

        <section className="card-x relative">
          <SeasonalCorner items={['⛄']} />
          <h3 className="font-semibold">💡 Ажиглалт</h3>
          <ul className="m-0 list-none p-0">{insights(entries).map(t => <li key={t} className="border-b py-2.5 text-sm last:border-0">{t}</li>)}</ul>
          <div className={cn('mt-2.5 border-l-4 border-l-primary pl-3', p.level === 'low' && 'border-l-warn', p.level === 'high' && 'border-l-ok')}><b className="text-sm">🔮 {p.title}</b></div>
        </section>

        <section className="card-x desk:col-span-2">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold">{now.getFullYear()} оны {now.getMonth() + 1}-р сар</h3>
            <Link href="/todo" className="text-sm font-semibold text-primary">🗓️ Ажил төлөвлөх →</Link>
          </div>
          <MoodCalendar year={now.getFullYear()} month={now.getMonth()} today={today()} avgOf={d => dayAvg(entries, d)} counts={planned} marks={marks} showTitles fire={activeDays}
            selected={sel ?? undefined} onPick={setSel} onMark={id => setSel(todos.find(t => t.id === id)?.planned_date ?? null)} />
          <p className="mt-2 text-xs text-muted-foreground">Өдөр дээр дарж тухайн өдрийн сэтгэл санаа, төлөвлөгөөг харна.</p>
          <Dialog open={sel != null} onOpenChange={o => { if (!o) setSel(null); }}>
            <DialogContent className="max-h-[88dvh] overflow-auto sm:max-w-[480px]">
              {sel && <DayDetail date={sel} />}
            </DialogContent>
          </Dialog>
        </section>
      </div>
    </>
  );
}

// Цагтай ажил эхэнд, цагаараа эрэмбэлэгдэнэ
const byTime = (a: Todo, b: Todo) => (a.planned_time ?? '99').localeCompare(b.planned_time ?? '99');

const LEVEL_LABEL: Record<number, string> = { 5: 'Маш сайн', 4: 'Сайн', 3: 'Дунд', 2: 'Муу', 1: 'Маш муу' };

/* Календарь дээр сонгосон өдөр: ямар түвшинтэй байсан, юу бүртгэсэн, ямар ажил төлөвлөсөн */
function DayDetail({ date }: { date: string }) {
  const { entries, todos } = useApp();
  const d = new Date(`${date}T00:00:00`);
  const dayE = entries.filter(e => e.entry_date === date);
  const avg = dayAvg(entries, date);
  const plans = todos.filter(t => t.planned_date === date).sort(byTime);

  return (
    <div className="flex flex-col gap-4">
      <div className="min-w-0">
        <div className="mb-2 flex flex-wrap items-center gap-2 pr-10">
          <DialogTitle className="text-base font-bold">{d.getMonth() + 1}-р сарын {d.getDate()} · {WD[d.getDay()]}</DialogTitle>
          {avg != null && <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', `lvl-${scoreLevel(avg)}`)}>{LEVEL_LABEL[scoreLevel(avg)]} · {avg.toFixed(1)} / 5</span>}
        </div>
        {dayE.length ? dayE.map(e => {
          const m = moodById(e.mood);
          return (
            <div key={e.id} className="flex items-start gap-2.5 border-b py-2 last:border-0">
              <MoodFace m={m} className="size-8 text-[1.4rem]" />
              <div className="min-w-0 flex-1 text-sm">
                <b>{m.label}</b> <span className="text-muted-foreground">· {e.entry_time.slice(0, 5)} · эрч хүч {e.intensity}/5{e.sleep != null && ` · нойр ${e.sleep} цаг`}</span>
                {e.tags.length > 0 && <div className="text-muted-foreground">{e.tags.join(', ')}</div>}
                {e.note && <div className="[overflow-wrap:anywhere]">{e.note}</div>}
              </div>
            </div>
          );
        }) : <p className="text-sm text-muted-foreground">Энэ өдөр сэтгэл санаа бүртгээгүй.</p>}
      </div>

      <div className="min-w-0 border-t pt-3">
        <h4 className="mb-2 font-semibold">🗓️ Төлөвлөгөө</h4>
        {plans.length ? plans.map(t => (
          <div key={t.id} className="flex items-start gap-2.5 border-b py-2 text-sm last:border-0">
            <span className="w-6 flex-none text-center text-base">{t.emoji ?? (t.done ? '✅' : '•')}</span>
            <div className="min-w-0 flex-1">
              <b className={cn('[overflow-wrap:anywhere]', t.done && 'text-muted-foreground line-through')}>{t.title}</b>
              <div className="text-muted-foreground">{t.planned_time && `${t.planned_time.slice(0, 5)} · `}{t.category} · {t.minutes} мин{t.done && ' · дууссан'}</div>
            </div>
          </div>
        )) : <p className="text-sm text-muted-foreground">Энэ өдөр төлөвлөсөн ажил алга.</p>}
        <Link href="/todo" className="mt-2 inline-block text-sm font-semibold text-primary">Төлөвлөгөө засах →</Link>
      </div>
    </div>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border bg-card p-3.5"><span className="text-sm text-muted-foreground">{label}</span><b className="block text-[1.4rem]">{children}</b></div>;
}
