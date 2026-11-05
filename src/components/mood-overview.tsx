'use client';

import { Flame } from '@/components/flame';
import { useState } from 'react';
import { DailyChart, WeekdayChart, type DayPoint } from '@/components/charts';
import { MoodFace } from '@/components/mood-face';
import { useApp } from '@/components/providers/app-provider';
import { SeasonalCorner } from '@/components/seasonal';
import { Segmented } from '@/components/segmented';
import { Button } from '@/components/ui/button';
import { dayAvg, insights, mean, prediction, scoreLevel, streak, weekdayStats } from '@/lib/analytics';
import { MOODS, WD, WD_SHORT, moodById } from '@/lib/data';
import { addDays, ymd } from '@/lib/date';
import { cn } from '@/lib/utils';
import { useT } from '@/components/providers/locale-provider';

const LEVEL_LABEL: Record<number, string> = { 5: 'Маш сайн', 4: 'Сайн', 3: 'Дунд', 2: 'Муу', 1: 'Маш муу' };

/* «Миний тойм»: Хуваарь хуудасны дээд хэсэг. Үзүүлэлтүүд үргэлж харагдана, график дарж дэлгэнэ
   (календарь хол доошоо түлхэгдэхгүйн тулд). */
export function MoodOverview() {
  const tr = useT();
  const { profile, entries } = useApp();
  const [range, setRange] = useState<7 | 30>(7);
  const [now] = useState(() => new Date());
  const [open, setOpen] = useState(false);

  const days = [...Array(range)].map((_, i) => addDays(now, i - range + 1));
  const series: DayPoint[] = days.map((d, i) => ({
    label: range === 7 ? tr(WD_SHORT[d.getDay()]) : i % 5 === 0 || i === days.length - 1 ? String(d.getDate()) : '',
    title: `${d.getMonth() + 1}/${d.getDate()} · ${tr(WD[d.getDay()])}`,
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
  const p = prediction(entries, profile.hobbies[0], tr);

  // График хаалттай бол эхлээд дэлгэж, зурагдсаны дараа хэвлэнэ
  const exportPdf = () => { setOpen(true); setTimeout(() => print(), 400); };

  return (
    <section aria-labelledby="overview-title" className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="overview-title" className="text-[1.15rem] font-bold">{tr('📈 Миний тойм')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={range} onChange={setRange} options={[[7, tr('7 хоног')], [30, tr('30 хоног')]]} />
          <Button variant="outline" size="xl" className="h-10" onClick={exportPdf}>⬇ PDF</Button>
        </div>
      </div>

      <div className="my-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label={tr('Дундаж оноо')}>{avg ? avg.toFixed(1) : '–'}<small className="text-muted-foreground"> / 5</small></Tile>
        <Tile label={tr('Бүртгэсэн өдөр')}>{logged.length}<small className="text-muted-foreground"> / {range}</small></Tile>
        <Tile label={tr('Дараалсан өдөр')}><Flame /> {streak(entries)}</Tile>
        <Tile label={tr('Их давтагдсан')}>{top ? `${moodById(top[0]).emoji} ${tr(moodById(top[0]).label)}` : '–'}</Tile>
      </div>

      <Button variant="secondary" size="xl" className="no-print h-10 w-full" aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? tr('▲ Графикийг хаах') : tr('▼ График, ажиглалт харах')}</Button>

      {open && (
        <div className="mt-3 grid gap-4 desk:grid-cols-2 desk:items-start">
          <section className="card-x relative">
            <SeasonalCorner />
            <h3 className="font-semibold">{tr('Өдөр тутмын сэтгэл санаа')}</h3>
            <DailyChart data={series} />
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-muted-foreground">{tr('Хүснэгтээр харах')}</summary>
              <table className="mt-2 w-full text-left">
                <thead><tr className="text-muted-foreground"><th className="font-medium">{tr('Өдөр')}</th><th className="font-medium">{tr('Дундаж')}</th></tr></thead>
                <tbody>{series.map(r => <tr key={r.title} className="border-t"><td className="py-1">{r.title}</td><td>{r.v == null ? '–' : r.v.toFixed(1)}</td></tr>)}</tbody>
              </table>
            </details>
          </section>

          <section className="card-x relative">
            <SeasonalCorner items={['🎁', '⭐']} />
            <h3 className="font-semibold">{tr('Гаригийн хэв маяг')}</h3>
            <WeekdayChart stats={ws} />
            {lowest && highest && valid.length >= 3 && (
              <p className="mt-3 text-sm">📉 <b>{tr(WD[lowest.w])}</b>{' '}{tr('гарагт хамгийн доогуур ({0}), 📈', lowest.avg!.toFixed(1))}{' '}<b>{tr(WD[highest.w])}</b>{' '}{tr('гарагт хамгийн өндөр ({0}) байдаг.', highest.avg!.toFixed(1))}</p>
            )}
          </section>

          <section className="card-x relative">
            <SeasonalCorner items={['☕', '🍪']} />
            <h3 className="mb-1 font-semibold">{tr('Сэтгэл хөдлөлийн тархалт')}</h3>
            {MOODS.map(m => {
              const pct = rangeE.length ? Math.round(((counts[m.id] || 0) / rangeE.length) * 100) : 0;
              return (
                <div key={m.id} className="my-2 flex items-center gap-2.5">
                  <MoodFace m={m} className="size-7 text-[1.3rem]" />
                  <span className="w-20 text-sm">{tr(m.label)}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-background"><i className="block h-full rounded-full" style={{ width: `${pct}%`, background: m.color }} /></div>
                  <span className="w-9 text-right text-sm text-muted-foreground">{pct}%</span>
                </div>
              );
            })}
          </section>

          <section className="card-x relative">
            <SeasonalCorner items={['⛄']} />
            <h3 className="font-semibold">{tr('💡 Ажиглалт')}</h3>
            <ul className="m-0 list-none p-0">{insights(entries, tr).map(t => <li key={t} className="border-b py-2.5 text-sm last:border-0">{t}</li>)}</ul>
            <div className={cn('mt-2.5 border-l-4 border-l-primary pl-3', p.level === 'low' && 'border-l-warn', p.level === 'high' && 'border-l-ok')}><b className="text-sm">🔮 {p.title}</b></div>
          </section>
        </div>
      )}
    </section>
  );
}

/* Календарь дээр сонгосон өдрийн сэтгэл санаа */
export function DayMood({ date }: { date: string }) {
  const tr = useT();
  const { entries } = useApp();
  const dayE = entries.filter(e => e.entry_date === date);
  const avg = dayAvg(entries, date);
  if (!dayE.length) return null;
  return (
    <div className="mb-2 rounded-xl bg-secondary/60 p-2.5">
      {avg != null && <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold', `lvl-${scoreLevel(avg)}`)}>{tr(LEVEL_LABEL[scoreLevel(avg)])} · {avg.toFixed(1)} / 5</span>}
      {dayE.map(e => {
        const m = moodById(e.mood);
        return (
          <div key={e.id} className="mt-1.5 flex items-start gap-2.5">
            <MoodFace m={m} className="size-8 text-[1.4rem]" />
            <div className="min-w-0 flex-1 text-sm">
              <b>{tr(m.label)}</b> <span className="text-muted-foreground">{tr('· {0} · эрч хүч {1}/5', e.entry_time.slice(0, 5), e.intensity)}{e.sleep != null && tr(' · нойр {0} цаг', e.sleep)}</span>
              {e.tags.length > 0 && <div className="text-muted-foreground">{e.tags.map(t => tr(t)).join(', ')}</div>}
              {e.note && <div className="[overflow-wrap:anywhere]">{e.note}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="rounded-2xl border bg-card p-3.5"><span className="text-sm text-muted-foreground">{label}</span><b className="block text-[1.4rem]">{children}</b></div>;
}
