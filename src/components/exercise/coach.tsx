'use client';

import { useEffect, useState } from 'react';
import { ExerciseArt } from '@/components/exercise-art';
import { Button } from '@/components/ui/button';
import { cueAt, moveSeconds, PREP_SECONDS, totalSeconds, type Move } from '@/lib/exercise-moves';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

type Status = 'ready' | 'run' | 'pause' | 'done';

/* Дасгалыг хөдөлгөөнт зурагтай хамт алхам алхмаар дагуулна. Хөдөлгөөн бүрийн өмнө 3 секунд бэлдэнэ.
   (Өмнө нь three.js 3D загвар байсан: утсан дээр удаан байсан тул хөнгөн SVG анимациар сольсон.) */
export function ExerciseCoach({ recId, moves, onFinish }: { recId: string; moves: Move[]; onFinish: () => void }) {
  const [status, setStatus] = useState<Status>('ready');
  const [i, setI] = useState(0);
  const [t, setT] = useState(-PREP_SECONDS);
  const m = moves[i];

  const go = (n: number) => {
    if (n >= moves.length) return setStatus('done');
    setI(Math.max(0, n));
    setT(-PREP_SECONDS);
  };
  if (status === 'run' && t >= moveSeconds(m)) go(i + 1);

  useEffect(() => {
    if (status !== 'run') return;
    let last = performance.now();
    const id = setInterval(() => {
      const at = performance.now(), dt = (at - last) / 1000;
      last = at;
      setT(x => x + dt);
    }, 100);
    return () => clearInterval(id);
  }, [status]);

  // Дасгал хийж байх хооронд утасны дэлгэц унтрахгүй
  useEffect(() => {
    if (status !== 'run') return;
    const lock = navigator.wakeLock?.request('screen').catch(() => null);
    return () => { void lock?.then(l => l?.release()); };
  }, [status]);

  const prep = t < 0;
  const done = status === 'done', ready = status === 'ready';
  const rep = Math.min(m.reps, Math.floor(Math.max(0, t) / m.period) + 1);
  const count = m.hold ? clock(Math.max(0, Math.ceil(moveSeconds(m) - Math.max(0, t)))) : `${rep} / ${m.reps}`;
  const cue = cueAt(m, Math.max(0, t));
  const spent = moves.slice(0, i).reduce((s, x) => s + moveSeconds(x) + PREP_SECONDS, 0) + t + PREP_SECONDS;
  const total = totalSeconds(moves);

  return (
    <div className="mt-3 min-w-0">
      <div className="relative h-[min(44dvh,340px)] overflow-hidden rounded-[18px] bg-[linear-gradient(180deg,var(--secondary),color-mix(in_srgb,var(--secondary)_55%,var(--card)))]">
        <ExerciseArt id={recId} className={`mx-auto size-full max-w-[340px] object-contain transition-opacity ${status === 'pause' ? 'opacity-60' : ''}`} />
        {!ready && !done && (
          <div className="pointer-events-none absolute inset-x-0 top-2.5 flex items-start justify-between px-3 text-sm font-bold">
            <span className="rounded-full bg-background/80 px-2.5 py-1">{i + 1} / {moves.length}</span>
            {!prep && <span className="rounded-full bg-background/80 px-2.5 py-1 tabular-nums" aria-label={m.hold ? 'Үлдсэн хугацаа' : 'Давталт'}>{count}</span>}
          </div>
        )}
        {status === 'run' && (prep || cue) && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center">
            <span className="rounded-full bg-primary px-4 py-1.5 text-lg font-extrabold text-primary-foreground tabular-nums">{prep ? `Бэлдээрэй · ${Math.ceil(-t)}` : cue}</span>
          </div>
        )}
      </div>

      {done ? (
        <>
          <p className="mt-3 text-center font-bold">Сайн байна 🌿 Дасгал дууслаа</p>
          <Button size="xl" className="mt-3 w-full" onClick={onFinish}>✓ Дууслаа</Button>
        </>
      ) : ready ? (
        <>
          <p className="mt-3 text-sm text-muted-foreground">Зургийг дагаад хамт хийгээрэй. Нийт {Math.ceil(total / 60)} мин.</p>
          <ol className="mt-2 list-decimal pl-5 text-sm">{[...new Set(moves.map(x => x.label))].map(l => <li key={l} className="mb-1">{l}</li>)}</ol>
          <Button size="xl" className="mt-3 w-full" onClick={() => setStatus('run')}>▶ Дагаж эхлэх</Button>
        </>
      ) : (
        <>
          <p className="mt-3 min-h-12 font-bold" aria-live="polite">{m.label}</p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label="Дасгалын явц" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((spent / total) * 100)}>
            <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${(spent / total) * 100}%` }} />
          </div>
          {moves[i + 1] && <p className="mt-1.5 truncate text-xs text-muted-foreground">Дараагийнх: {moves[i + 1].label}</p>}
          <div className="mt-3 flex gap-2">
            <Button size="xl" variant="secondary" className="flex-none" disabled={i === 0} aria-label="Өмнөх алхам" onClick={() => go(i - 1)}>⏮</Button>
            <Button size="xl" className="flex-1" onClick={() => setStatus(status === 'run' ? 'pause' : 'run')}>{status === 'run' ? '⏸ Түр зогсоох' : '▶ Үргэлжлүүлэх'}</Button>
            <Button size="xl" variant="secondary" className="flex-none" aria-label="Дараагийн алхам" onClick={() => go(i + 1)}>⏭</Button>
          </div>
        </>
      )}
    </div>
  );
}
