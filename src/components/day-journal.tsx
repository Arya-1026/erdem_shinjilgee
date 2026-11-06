'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useApp } from '@/components/providers/app-provider';
import { useT } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { MOODS, moodById } from '@/lib/data';
import { cn } from '@/lib/utils';
import type { DayJournal, DayNote, MoodId } from '@/lib/types';

/* Өдрийн тэмдэглэл, нэмэлт тэмдэглэлийг харуулах (зөвхөн унших) */
export function DayWriting({ journal, notes, brief }: { journal?: DayJournal; notes: DayNote[]; brief?: boolean }) {
  const tr = useT();
  if (!journal && !notes.length) return null;
  const m = journal?.mood ? moodById(journal.mood) : null;
  return (
    <div className="flex flex-col gap-2 text-sm">
      {journal && (
        <div className="rounded-xl bg-secondary/60 p-2.5">
          <b>{tr('📔 Өдрийн тэмдэглэл')}</b>
          {m && <span className="ml-1.5 text-muted-foreground">· {m.emoji} {tr(m.label)}</span>}
          {journal.body && <p className={cn('mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]', brief && 'line-clamp-3')}>{journal.body}</p>}
        </div>
      )}
      {notes.map(n => (
        <div key={n.id} className="rounded-xl border p-2.5">
          <b>{tr('📝 Нэмэлт тэмдэглэл')}</b>
          <p className={cn('mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]', brief && 'line-clamp-3')}>{n.body}</p>
        </div>
      ))}
    </div>
  );
}

/* Нүүрний дээд талын нэг мөр: дарахад бичих цонх нээгдэнэ */
export function JournalButton({ date }: { date: string }) {
  const tr = useT();
  const { journals, openDialog } = useApp();
  const saved = journals.find(j => j.day === date);
  const m = saved?.mood ? moodById(saved.mood) : null;
  return (
    <button type="button" onClick={() => openDialog({ kind: 'journal', date })} className="card-x mt-3 flex w-full items-center gap-3 py-3 text-left">
      <span className="text-2xl" aria-hidden>{m?.emoji ?? '📔'}</span>
      <span className="min-w-0 flex-1">
        <b className="block">{tr('Өдрийн тэмдэглэл')}</b>
        <span className="block truncate text-sm text-muted-foreground">{saved?.body || tr('Өнөөдрөө товч бичээрэй')}</span>
      </span>
      <span className="text-muted-foreground" aria-hidden>›</span>
    </button>
  );
}

/* Бичих цонх: сэтгэл санаа + тэмдэглэл. Өдөрт нэг, дахин хадгалахад шинэчлэгдэнэ. */
export function DayJournalForm({ date, onDone }: { date: string; onDone: () => void }) {
  const tr = useT();
  const { journals, saveJournal } = useApp();
  const saved = journals.find(j => j.day === date);
  const [mood, setMood] = useState<MoodId | null>(saved?.mood ?? null);
  const [body, setBody] = useState(saved?.body ?? '');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const ok = await saveJournal(date, mood, body.trim());
    setBusy(false);
    if (!ok) return;
    toast(tr('Өдрийн тэмдэглэл хадгалагдлаа 📔'));
    onDone();
  }

  return (
    <div className="mt-3 flex flex-col gap-3">
      <div className="flex justify-between gap-1" role="radiogroup" aria-label={tr('Өдрийн ерөнхий сэтгэл санаа')}>
        {MOODS.map(m => (
          <button key={m.id} type="button" role="radio" aria-checked={mood === m.id} aria-label={tr(m.label)} title={tr(m.label)} onClick={() => setMood(mood === m.id ? null : m.id)}
            className={cn('grid size-10 place-items-center rounded-full text-2xl', mood === m.id && 'bg-primary/15 ring-2 ring-primary')}>{m.emoji}</button>
        ))}
      </div>
      <textarea rows={4} value={body} onChange={e => setBody(e.target.value)} maxLength={5000} placeholder={tr('Өнөөдөр өдөр чинь ямар өнгөрөв?')} aria-label={tr('Өдрийн тэмдэглэл')}
        className="w-full resize-y rounded-xl border-[1.5px] bg-background px-3 py-2.5 focus:border-primary focus:outline-none" />
      <Button size="xl" className="w-full" disabled={busy || (!body.trim() && !mood)} onClick={() => void submit()}>{busy ? tr('Хадгалж байна…') : tr('Хадгалах')}</Button>
    </div>
  );
}
