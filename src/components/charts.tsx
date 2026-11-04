'use client';

import { Bar, BarChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { MOODS, WD, WD_SHORT } from '@/lib/data';
import { scoreLevel } from '@/lib/analytics';
import { cn } from '@/lib/utils';

/* Графикийн өнгийг globals.css-ийн token-оос авна → харанхуй горимд өөрөө солигдоно */
const AXIS = { stroke: 'var(--chart-axis)', fontSize: 11, tickLine: false, axisLine: false } as const;
const scoreLabel = (v: number) => `${v.toFixed(1)} / 5`;
const nearestMood = (v: number) => MOODS.reduce((a, b) => (Math.abs(b.score - v) < Math.abs(a.score - v) ? b : a));

function Tip({ active, payload, title }: { active?: boolean; payload?: readonly { payload?: unknown }[]; title: (p: Record<string, unknown>) => string }) {
  const row = payload?.[0]?.payload as Record<string, unknown> | undefined;
  if (!active || !row) return null;
  const v = row.v as number | null;
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-sm shadow-lg">
      <div className="text-muted-foreground">{title(row)}</div>
      <b>{v == null ? 'Бүртгэлгүй' : `${scoreLabel(v)} · ${nearestMood(v).emoji} ${nearestMood(v).label}`}</b>
      {typeof row.n === 'number' && row.n > 0 && <div className="text-xs text-muted-foreground">{row.n} бүртгэл</div>}
    </div>
  );
}

export type DayPoint = { label: string; title: string; v: number | null };

/* Өдөр тутмын сэтгэл санаа: шугаман график (нэг цуврал → legend хэрэггүй, гарчиг нэрлэнэ) */
export function DailyChart({ data }: { data: DayPoint[] }) {
  return (
    <LineChart responsive data={data} style={{ width: '100%', height: 190 }} margin={{ top: 8, right: 8, bottom: 0, left: -24 }} accessibilityLayer>
      <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
      <XAxis dataKey="label" {...AXIS} interval={0} />
      <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} {...AXIS} />
      <Tooltip cursor={{ stroke: 'var(--chart-axis)', strokeDasharray: '3 3' }} content={p => <Tip {...p} title={r => String(r.title)} />} />
      <Line type="monotone" dataKey="v" stroke="var(--chart-line)" strokeWidth={2} connectNulls={false} isAnimationActive={false}
        dot={{ r: 4, fill: 'var(--chart-line)', stroke: 'var(--card)', strokeWidth: 2 }} activeDot={{ r: 6, stroke: 'var(--card)', strokeWidth: 2 }} />
    </LineChart>
  );
}

/* Гаригийн хэв маяг: баганан график, Даваагаас эхэлнэ */
export function WeekdayChart({ stats }: { stats: { w: number; avg: number | null; n: number }[] }) {
  const data = [1, 2, 3, 4, 5, 6, 0].map(w => ({ label: WD_SHORT[w], title: WD[w] + ' гараг', v: stats[w].avg, n: stats[w].n }));
  return (
    <BarChart responsive data={data} style={{ width: '100%', height: 190 }} margin={{ top: 8, right: 8, bottom: 0, left: -24 }} accessibilityLayer>
      <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
      <XAxis dataKey="label" {...AXIS} />
      <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} {...AXIS} />
      <Tooltip cursor={{ fill: 'var(--muted)' }} content={p => <Tip {...p} title={r => String(r.title)} />} />
      <Bar dataKey="v" fill="var(--chart-line)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
    </BarChart>
  );
}

/* Сарын heatmap: diverging шкал (1 муу → 3 дунд → 5 сайн), өнгө + тоо + tooltip */
export function MoodCalendar({ year, month, today, avgOf, counts, selected, onPick }: { year: number; month: number; today: string; avgOf: (date: string) => number | null; counts?: Record<string, number>; selected?: string; onPick?: (date: string) => void }) {
  const dim = new Date(year, month + 1, 0).getDate(), off = (new Date(year, month, 1).getDay() + 6) % 7;
  const ds = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return (
    <>
      <div className="grid grid-cols-7 gap-1.5" role="grid" aria-label="Сарын mood календарь">
        {['Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя', 'Ня'].map(d => <div key={d} className="text-center text-xs font-semibold text-muted-foreground">{d}</div>)}
        {Array.from({ length: off }, (_, i) => <div key={'e' + i} />)}
        {Array.from({ length: dim }, (_, i) => {
          const date = ds(i + 1), v = avgOf(date);
          const tip = v == null ? `${date}: бүртгэлгүй` : `${date}: ${scoreLabel(v)}`;
          return (
            <div key={date} title={tip} role="gridcell" aria-selected={selected === date}
              className={cn('relative grid aspect-square place-items-center rounded-[10px] text-[.8rem]', v == null ? 'bg-background' : `lvl-${scoreLevel(v)}`,
                date === today && 'outline-2 outline-offset-1 outline-primary', selected === date && 'ring-2 ring-foreground')}>
              {onPick ? <button className="size-full rounded-[10px]" aria-label={`${tip}${counts?.[date] ? `, ${counts[date]} ажил` : ''}`} onClick={() => onPick(date)}>{i + 1}</button> : i + 1}
              {!!counts?.[date] && <span className="pointer-events-none absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-primary text-[.6rem] font-bold text-primary-foreground">{counts[date]}</span>}
            </div>
          );
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2.5 text-xs text-muted-foreground">
        {([[5, 'Маш сайн'], [4, 'Сайн'], [3, 'Дунд'], [2, 'Муу'], [1, 'Маш муу']] as const).map(([s, l]) => (
          <span key={s} className="inline-flex items-center gap-1"><i className={cn('inline-block size-3 rounded', `lvl-${s}`)} />{l}</span>
        ))}
      </div>
    </>
  );
}
