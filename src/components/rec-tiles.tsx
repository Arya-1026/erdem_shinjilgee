'use client';

import { moodById } from '@/lib/data';
import type { Mood, ScoredRec } from '@/lib/types';
import { ExerciseArt } from './exercise-art';
import { Poster } from './poster';
import { useApp } from './providers/app-provider';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { useT } from '@/components/providers/locale-provider';

// Зөвлөмж дээр дарахад: кино → дэлгэрэнгүй, дасгал → алхмууд
export function useRecAction() {
  const { openDialog } = useApp();
  return (r: ScoredRec, m: Mood) => {
    if (r.type === 'movie') return openDialog({ kind: 'movie', recId: r.id, mood: m.id });
    openDialog(r.action === 'breath' ? { kind: 'breath' } : { kind: 'exercise', recId: r.id });
  };
}

/* Нүүрний хажуу тийш гүйлгэдэг жижиг tile */
export function RecTile({ r, m }: { r: ScoredRec; m: Mood }) {
  const tr = useT();
  const act = useRecAction();
  return (
    <button onClick={() => act(r, m)} className="htile flex w-[132px] flex-none snap-start flex-col self-start text-left">
      <div className={cn('tile-cover relative mb-1.5 grid w-[132px] place-items-center overflow-hidden rounded-2xl text-[2.4rem]', r.type === 'movie' ? 'h-[192px]' : 'h-[132px]')} style={{ '--tc': moodById(r.moods[0]).color } as React.CSSProperties}>
        {r.type === 'movie' ? <Poster src={r.poster} title={tr(r.title)} className="size-full" /> : <ExerciseArt id={r.id} className="size-full" />}
      </div>
      <b className="line-clamp-2 text-sm leading-tight">{tr(r.title)}</b>
      <span className="block truncate text-xs text-muted-foreground">{tr(r.sub)}</span>
    </button>
  );
}

/* Зөвлөмж хуудасны карт: үйлдэл + 👍/👎 */
export function RecCard({ r, m, onFeedback }: { r: ScoredRec; m: Mood; onFeedback: (id: string, v: number) => void }) {
  const tr = useT();
  const act = useRecAction();
  return (
    <article className="card-x flex flex-col gap-2.5">
      <div className="flex items-start gap-3">
        {r.type === 'movie'
          ? <Poster src={r.poster} title={tr(r.title)} className="h-[96px] w-16 flex-none rounded-lg bg-secondary text-xl" />
          : <ExerciseArt id={r.id} className="size-11 flex-none rounded-xl" />}
        <div className="min-w-0">
          <b>{tr(r.title)}</b>
          <div className="text-sm text-muted-foreground">{tr(r.sub)}</div>
          {r.moves && <Badge variant="secondary" className="mt-1 mr-1">{tr('Дагаж хийнэ')}</Badge>}
          {r.hob && <Badge className="mt-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">{tr('Таны хоббид тохирсон')}</Badge>}
        </div>
      </div>
      <div className="mt-auto flex items-center gap-2">
        {r.type === 'exercise' && <Button size="xl" className="h-[42px] flex-1" onClick={() => act(r, m)}>{tr('▶ Эхлэх')}</Button>}
        {r.type === 'movie' && <Button size="xl" variant="secondary" className="h-[42px] flex-1" onClick={() => act(r, m)}>{tr('Дэлгэрэнгүй')}</Button>}
        <button className={cn('size-[42px] flex-none rounded-[10px] border-[1.5px]', r.fb === 1 && 'border-primary bg-secondary')} aria-label={tr('Таалагдсан')} aria-pressed={r.fb === 1} onClick={() => onFeedback(r.id, 1)}>👍</button>
        <button className="size-[42px] flex-none rounded-[10px] border-[1.5px]" aria-label={tr('Таалагдаагүй')} onClick={() => onFeedback(r.id, -1)}>👎</button>
      </div>
    </article>
  );
}
