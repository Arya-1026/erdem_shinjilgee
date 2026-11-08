'use client';

import { useEffect, useRef, useState } from 'react';
import { useT } from '@/components/providers/locale-provider';
import { DASS_CHOICES, DASS_COUNT, DASS_ITEMS } from '@/lib/dass';
import { cn } from '@/lib/utils';

/** Сонголт тодорсныг харуулаад дараагийн асуулт руу шилжих хүртэлх хугацаа */
const PICK_MS = 550;

/* ---------- Асуулт: нэг дэлгэцэд нэг. Сонголт тодорч, «бүртгэгдлээ» гэж харуулаад дараагийнх руу гулсаж шилжинэ ---------- */
export function DassQuiz({ answers, saving, earlier, onAnswer, onBack, onExit }: { answers: number[]; saving: boolean; earlier: number | null; onAnswer: (v: number) => void; onBack: () => void; onExit: () => void }) {
  const tr = useT();
  const i = Math.min(answers.length, DASS_COUNT - 1);
  const [picked, setPicked] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const pick = (v: number) => {
    if (picked != null || saving) return;
    setPicked(v);
    navigator.vibrate?.(10);
    timer.current = setTimeout(() => { setPicked(null); onAnswer(v); }, PICK_MS);
  };
  const busy = picked != null || saving;
  return (
    <section className="card-x mx-auto max-w-[620px]">
      <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
        <span>{tr('Асуулт {0} / {1}', i + 1, DASS_COUNT)}</span>
        <button type="button" className="hover:text-foreground" onClick={onExit}>{tr('Түр гарах')}</button>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label={tr('Асуулгын явц')} aria-valuemin={0} aria-valuemax={DASS_COUNT} aria-valuenow={answers.length}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${(answers.length / DASS_COUNT) * 100}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{tr('Хариулсан: {0} / {1}', answers.length, DASS_COUNT)}</p>
      <div key={i} className="dass-q">
        <p className="mt-4 text-sm text-muted-foreground">{tr('Сүүлийн 7 хоногт…')}</p>
        <h2 className="mt-1 min-h-[3.5em] text-[1.2rem] leading-snug font-bold">{tr(DASS_ITEMS[i].mn)}</h2>
        <div className="mt-4 grid gap-2.5" role="radiogroup" aria-label={tr(DASS_ITEMS[i].mn)}>
          {DASS_CHOICES.map((c, v) => {
            const on = picked === v, was = picked == null && earlier === v;
            return (
              <button key={v} type="button" role="radio" aria-checked={on} disabled={busy && !on} onClick={() => pick(v)}
                className={cn('flex min-h-14 items-center gap-3 rounded-2xl border-[1.5px] bg-background px-4 text-left font-semibold transition-all duration-200',
                  on ? 'scale-[1.02] border-primary bg-primary text-primary-foreground shadow-md'
                    : 'hover:border-primary hover:bg-secondary disabled:opacity-45',
                  was && 'border-primary border-dashed')}>
                <span className={cn('grid size-8 flex-none place-items-center rounded-full text-sm tabular-nums', on ? 'bg-primary-foreground text-primary' : 'bg-secondary')}>{on ? '✓' : v}</span>
                <span className="min-w-0 flex-1">{tr(c)}</span>
                {was && <span className="flex-none text-xs font-normal text-primary">{tr('Өмнө сонгосон')}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <p className={cn('mt-3 min-h-5 text-center text-sm font-semibold text-primary transition-opacity', picked == null && 'opacity-0')} aria-live="polite">
        {picked != null && (answers.length + 1 < DASS_COUNT ? `${tr('✓ Хариулт бүртгэгдлээ')} · ${tr('Дараагийн асуулт руу шилжиж байна…')}` : tr('✓ Хариулт бүртгэгдлээ'))}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2 text-sm">
        <button type="button" className="font-semibold text-primary disabled:opacity-40" disabled={!answers.length || busy} onClick={onBack}>{tr('← Өмнөх асуулт')}</button>
        <span className="text-right text-muted-foreground">{i === 0 && !answers.length ? tr('Сонголтоо дарахад дараагийн асуулт руу автоматаар шилжинэ.') : tr('Зөв, буруу хариулт байхгүй')}</span>
      </div>
    </section>
  );
}
