'use client';

import { useId } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { MOODS, WD, WD_SHORT } from '@/lib/data';
import { scoreLevel } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { useT } from '@/components/providers/locale-provider';

/* Графикийн өнгийг globals.css-ийн token-оос авна → харанхуй горимд өөрөө солигдоно */
const AXIS = { stroke: 'var(--chart-axis)', fontSize: 11, tickLine: false, axisLine: false } as const;
const scoreLabel = (v: number) => `${v.toFixed(1)} / 5`;
const nearestMood = (v: number) => MOODS.reduce((a, b) => (Math.abs(b.score - v) < Math.abs(a.score - v) ? b : a));

function Tip({ active, payload, title }: { active?: boolean; payload?: readonly { payload?: unknown }[]; title: (p: Record<string, unknown>) => string }) {
  const tr = useT();
  const row = payload?.[0]?.payload as Record<string, unknown> | undefined;
  if (!active || !row) return null;
  const v = row.v as number | null;
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-sm shadow-lg">
      <div className="text-muted-foreground">{title(row)}</div>
      <b>{v == null ? tr('Бүртгэлгүй') : `${scoreLabel(v)} · ${nearestMood(v).emoji} ${tr(nearestMood(v).label)}`}</b>
      {typeof row.n === 'number' && row.n > 0 && <div className="text-xs text-muted-foreground">{tr('{0} бүртгэл', row.n)}</div>}
    </div>
  );
}

export type DayPoint = { label: string; title: string; v: number | null };

// Дундаж оноог (1–5) тархалтын графиктай ижил mood-ийн өнгөөр будна
const LEVEL_MOOD = { 5: 'happy', 4: 'calm', 3: 'neutral', 2: 'anxious', 1: 'sad' } as const;
const levelColor = (v: number) => MOODS.find(m => m.id === LEVEL_MOOD[scoreLevel(v)])!.color;

/* Өдөр тутмын сэтгэл санаа: шугаман график (нэг цуврал → legend хэрэггүй, гарчиг нэрлэнэ).
   Шугам өндрөөсөө хамаарч mood-ийн өнгөөр уусна, цэг бүр өөрийн mood-ийн өнгөтэй. */
export function DailyChart({ data }: { data: DayPoint[] }) {
  const gid = `daily-${useId().replace(/:/g, '')}`;
  const vs = data.flatMap(d => (d.v == null ? [] : [d.v]));
  const hi = Math.max(...vs), lo = Math.min(...vs);
  // objectBoundingBox градиент нь шугамын өндрөөр сунана: хамгийн их утга 0%, бага нь 100%.
  // Бүх утга тэнцүү бол хүрээ 0 өндөртэй болж градиент харагдахгүй тул нэг өнгө хэрэглэнэ.
  const stops = vs.length && hi > lo ? [5, 4, 3, 2, 1].filter(s => s <= hi + 0.5 && s >= lo - 0.5).map(s => ({ off: Math.min(1, Math.max(0, (hi - s) / (hi - lo))), c: levelColor(s) })) : [];
  const stroke = stops.length ? `url(#${gid})` : vs.length ? levelColor(vs[0]) : 'var(--chart-line)';
  return (
    <LineChart responsive data={data} style={{ width: '100%', height: 190 }} margin={{ top: 8, right: 8, bottom: 0, left: -24 }} accessibilityLayer>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          {stops.map(s => <stop key={s.off} offset={s.off} stopColor={s.c} />)}
        </linearGradient>
      </defs>
      <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
      <XAxis dataKey="label" {...AXIS} interval={0} />
      <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} {...AXIS} />
      <Tooltip cursor={{ stroke: 'var(--chart-axis)', strokeDasharray: '3 3' }} content={p => <Tip {...p} title={r => String(r.title)} />} />
      <Line type="monotone" dataKey="v" stroke={stroke} strokeWidth={2.5} connectNulls={false} isAnimationActive={false}
        dot={p => <MoodDot key={p.index} {...p} r={4.5} />} activeDot={p => <MoodDot key={p.index} {...p} r={6.5} />} />
    </LineChart>
  );
}

function MoodDot({ cx, cy, payload, r }: { cx?: number; cy?: number; payload?: DayPoint; r: number }) {
  if (cx == null || cy == null || payload?.v == null) return null;
  return <circle cx={cx} cy={cy} r={r} fill={levelColor(payload.v)} stroke="var(--card)" strokeWidth={2} />;
}

/* Гаригийн хэв маяг: баганан график, Даваагаас эхэлнэ. Багана бүр дундаж сэтгэл санааныхаа өнгөтэй. */
export function WeekdayChart({ stats }: { stats: { w: number; avg: number | null; n: number }[] }) {
  const tr = useT();
  const data = [1, 2, 3, 4, 5, 6, 0].map(w => ({ label: tr(WD_SHORT[w]), title: tr(WD[w]) + tr(' гараг'), v: stats[w].avg, n: stats[w].n }));
  return (
    <BarChart responsive data={data} style={{ width: '100%', height: 190 }} margin={{ top: 8, right: 8, bottom: 0, left: -24 }} accessibilityLayer>
      <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
      <XAxis dataKey="label" {...AXIS} />
      <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} {...AXIS} />
      <Tooltip cursor={{ fill: 'var(--muted)' }} content={p => <Tip {...p} title={r => String(r.title)} />} />
      <Bar dataKey="v" fill="var(--chart-line)" radius={[4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false}>
        {data.map(d => <Cell key={d.label} fill={d.v == null ? 'var(--chart-line)' : levelColor(d.v)} />)}
      </Bar>
    </BarChart>
  );
}

/* Сарын heatmap: diverging шкал (1 муу → 3 дунд → 5 сайн), өнгө + тоо + tooltip */
export type CalendarMark = { id: string; emoji: string; title: string };

export function MoodCalendar({ year, month, today, avgOf, counts, marks, showTitles, fire, selected, onPick, onMark }: { year: number; month: number; today: string; avgOf: (date: string) => number | null; counts?: Record<string, number>; /** 🔥 тавих өдрүүд (бүртгэл хийсэн, идэвхтэй) */ fire?: Set<string>; marks?: Record<string, CalendarMark[]>; /** Том дэлгэцэд ажлын нэрийг (2 хүртэл) нүдэнд харуулна */ showTitles?: boolean; selected?: string; onPick?: (date: string) => void; onMark?: (id: string) => void }) {
  const tr = useT();
  const dim = new Date(year, month + 1, 0).getDate(), off = (new Date(year, month, 1).getDay() + 6) % 7;
  const ds = (d: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return (
    <>
      <div className="grid grid-cols-7 gap-1.5" role="grid" aria-label={tr('Сарын mood календарь')}>
        {[tr('Да'), tr('Мя'), tr('Лх'), tr('Пү'), tr('Ба'), tr('Бя'), tr('Ня')].map(d => <div key={d} className="text-center text-xs font-semibold text-muted-foreground">{d}</div>)}
        {Array.from({ length: off }, (_, i) => <div key={'e' + i} />)}
        {Array.from({ length: dim }, (_, i) => {
          const date = ds(i + 1), v = avgOf(date), em = marks?.[date] ?? [];
          const tip = v == null ? tr('{0}: бүртгэлгүй', date) : `${date}: ${scoreLabel(v)}`;
          // Тухайн өдрийн төлөвлөгөөний эможи: 3 хүртэл, үлдсэнийг +n. Хулгана аваачихад нэр нь гарна, дарвал засна.
          const label = em.length ? (
            <span className="flex flex-col items-center leading-none">
              {i + 1}
              <span className="mt-1 flex text-[clamp(.7rem,2.2vw,1.05rem)] whitespace-nowrap" aria-hidden>
                {em.slice(0, 3).map(m => (
                  <span key={m.id} title={m.title} className="cursor-pointer rounded px-px hover:bg-foreground/15" onClick={() => onMark?.(m.id)}>{m.emoji}</span>
                ))}
                {em.length > 3 && <small className="self-center text-[.6rem]" title={em.slice(3).map(m => m.title).join('\n')}>+{em.length - 3}</small>}
              </span>
              {showTitles && (
                <span className="mt-1 hidden w-full flex-col gap-px px-1 text-[.68rem] leading-tight md:flex" aria-hidden>
                  {em.slice(0, 2).map(m => <span key={m.id} className="truncate">{m.title}</span>)}
                </span>
              )}
            </span>
          ) : i + 1;
          const names = em.map(m => m.title).join(', ');
          return (
            <div key={date} title={tip} role="gridcell" aria-selected={selected === date}
              className={cn('relative grid aspect-square place-items-center rounded-[10px] text-[.8rem]', v == null ? 'bg-background' : `lvl-${scoreLevel(v)}`,
                date === today && 'outline-2 outline-offset-1 outline-primary', selected === date && 'ring-2 ring-foreground')}>
              {onPick ? <button className="size-full rounded-[10px]" aria-label={`${tip}${counts?.[date] ? tr(', {0} ажил', counts[date]) : ''}${names ? `: ${names}` : ''}`} onClick={() => onPick(date)}>{label}</button> : label}
              {fire?.has(date) && <span className="cal-fire pointer-events-none absolute bottom-0.5 left-1 text-[clamp(.6rem,1.5vw,.95rem)] leading-none" aria-hidden>🔥</span>}
              {!!counts?.[date] && <span className="pointer-events-none absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-primary text-[.6rem] font-bold text-primary-foreground">{counts[date]}</span>}
            </div>
          );
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-2.5 text-xs text-muted-foreground">
        {([[5, tr('Маш сайн')], [4, tr('Сайн')], [3, tr('Дунд')], [2, tr('Муу')], [1, tr('Маш муу')]] as const).map(([s, l]) => (
          <span key={s} className="inline-flex items-center gap-1"><i className={cn('inline-block size-3 rounded', `lvl-${s}`)} />{l}</span>
        ))}
        {fire && <span className="inline-flex items-center gap-1">{tr('🔥 Идэвхтэй өдөр')}</span>}
      </div>
    </>
  );
}
