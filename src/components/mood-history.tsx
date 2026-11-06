'use client';

import { useState } from 'react';
import { DayWriting } from '@/components/day-journal';
import { MoodFace } from '@/components/mood-face';
import { useApp } from '@/components/providers/app-provider';
import { useT } from '@/components/providers/locale-provider';
import { Chip, Segmented } from '@/components/segmented';
import { MOODS, WD, moodById } from '@/lib/data';
import { weekdayOf } from '@/lib/date';
import { dateParts, filterDayNotes, filterEntries, filterJournals, groupByDay, groupByMood } from '@/lib/history';
import type { Entry, MoodId } from '@/lib/types';

const PAGE = 40;

function EntryRow({ e, showDate }: { e: Entry; showDate: boolean }) {
  const tr = useT();
  const m = moodById(e.mood);
  const [y, mo, d] = dateParts(e.entry_date);
  return (
    <article className="flex items-start gap-3 border-b py-3 last:border-0">
      <MoodFace m={m} className="size-10 text-[1.8rem]" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <b>{tr(m.label)}</b>
          <time dateTime={`${e.entry_date}T${e.entry_time.slice(0, 5)}`} className="text-sm text-muted-foreground tabular-nums">
            {showDate && `${tr('{0} оны {1}-р сарын {2}', y, mo, d)}, `}{e.entry_time.slice(0, 5)}
          </time>
        </div>
        <div className="text-sm text-muted-foreground">
          {tr('Эрч хүч {0}/5', e.intensity)}{e.sleep != null && tr(' · нойр {0} цаг', e.sleep)}{e.tags.length > 0 && ` · ${e.tags.map(t => tr(t)).join(', ')}`}
        </div>
        {e.note.trim() && <p className="mt-1.5 rounded-xl bg-secondary/60 px-3 py-2 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">{e.note}</p>}
      </div>
    </article>
  );
}

/* Профайл → Түүх: сэтгэл хөдлөл, тэмдэглэлийг огноо, цагтай нь харах */
export function MoodHistory() {
  const tr = useT();
  const { entries, journals, dayNotes } = useApp();
  const [view, setView] = useState<'day' | 'mood'>('day');
  const [mood, setMood] = useState<MoodId | null>(null);
  const [date, setDate] = useState('');
  const [notesOnly, setNotesOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const filter = { mood, date, notesOnly };
  const list = filterEntries(entries, filter), days = filterJournals(journals, filter), extras = filterDayNotes(dayNotes, filter);
  const shown = list.slice(0, limit);
  const reset = (f: () => void) => { f(); setLimit(PAGE); };

  return (
    <div className="flex flex-col gap-4">
      <section className="card-x flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented label={tr('Бүлэглэх')} value={view} onChange={setView} options={[['day', tr('📅 Өдрөөр')], ['mood', tr('😊 Сэтгэл хөдлөлөөр')]]} />
          <span className="text-sm text-muted-foreground" aria-live="polite">{tr('{0} бүртгэл', list.length)}</span>
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar" aria-label={tr('Сэтгэл хөдлөлөөр шүүх')}>
          <Chip on={!mood} onClick={() => reset(() => setMood(null))}>{tr('Бүгд')}</Chip>
          {MOODS.map(m => <Chip key={m.id} on={mood === m.id} onClick={() => reset(() => setMood(mood === m.id ? null : m.id))}>{m.emoji} {tr(m.label)}</Chip>)}
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="flex items-center gap-2 text-sm">
            {tr('Өдөр')}
            <input type="date" value={date} onChange={e => reset(() => setDate(e.target.value))} className="min-h-10 rounded-xl border-[1.5px] bg-background px-2.5 focus:border-primary focus:outline-none" />
          </label>
          {date && <button type="button" className="text-sm font-semibold text-primary" onClick={() => reset(() => setDate(''))}>{tr('Цэвэрлэх')}</button>}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-5 accent-primary" checked={notesOnly} onChange={e => reset(() => setNotesOnly(e.target.checked))} />
            {tr('Зөвхөн тэмдэглэлтэй')}
          </label>
        </div>
      </section>

      {!list.length && !days.length && !extras.length && <p className="card-x text-sm text-muted-foreground">{tr('Энэ шүүлтүүрт бүртгэл олдсонгүй.')}</p>}

      {view === 'day' ? groupByDay(shown, days, extras).map(g => {
        const [y, mo, d] = dateParts(g.date);
        return (
          <section key={g.date} className="card-x">
            <h3 className="font-semibold">{tr('{0} оны {1}-р сарын {2}', y, mo, d)} <span className="font-normal text-muted-foreground">· {tr(WD[weekdayOf(g.date)])}</span></h3>
            {g.items.map(e => <EntryRow key={e.id} e={e} showDate={false} />)}
            {(g.journal || g.notes.length > 0) && <div className="mt-2"><DayWriting journal={g.journal} notes={g.notes} /></div>}
          </section>
        );
      }) : groupByMood(shown, days).map(g => {
        const m = moodById(g.mood);
        return (
          <section key={g.mood} className="card-x">
            <h3 className="flex items-center gap-2 font-semibold"><MoodFace m={m} className="size-7 text-[1.3rem]" /> {tr(m.label)} <span className="font-normal text-muted-foreground">· {g.items.length}</span></h3>
            {g.items.map(e => <EntryRow key={e.id} e={e} showDate />)}
            {g.journals.map(j => { const [y, mo, d] = dateParts(j.day); return <div key={j.day} className="mt-2"><p className="mb-1 text-sm text-muted-foreground">{tr('{0} оны {1}-р сарын {2}', y, mo, d)}</p><DayWriting journal={j} notes={[]} /></div>; })}
          </section>
        );
      })}

      {list.length > limit && <button type="button" className="card-x font-semibold text-primary" onClick={() => setLimit(l => l + PAGE)}>{tr('Цааш харах')}</button>}
    </div>
  );
}
