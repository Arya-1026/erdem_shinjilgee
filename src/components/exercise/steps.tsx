'use client';

import { useState } from 'react';
import { ExerciseArt, exerciseAnimSrc } from '@/components/exercise-art';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Алхам бүрийн дүрс. Биеийн хөдөлгөөнгүй дасгалуудад алхам алхмаар хөдөлгөөнт дүрсээр харуулна.
const ICONS: Record<string, string[]> = {
  e2: ['👀', '✋', '👂', '👃', '👅'],
  e5: ['✍️', '💭'],
  e8: ['🖍️', '🎨', '🏷️'],
  e9: ['📝', '🎯', '💬', '⏱️'],
  e10: ['📝', '🗣️', '🤲', '🕰️', '👂'],
};

export function StepCoach({ recId, steps, onFinish }: { recId: string; steps: string[]; onFinish: () => void }) {
  const [i, setI] = useState(0);
  const last = i === steps.length - 1;
  return (
    <div className="mt-3">
      <div key={i} className="step-card flex min-h-[230px] flex-col items-center justify-center gap-3 rounded-[18px] bg-secondary p-5 text-center">
        {exerciseAnimSrc(recId)
          ? <span className="relative"><ExerciseArt id={recId} className="size-36 rounded-3xl" />
              <span className="step-icon absolute -right-2 -bottom-2 grid size-12 place-items-center rounded-full bg-card text-2xl shadow" aria-hidden="true">{ICONS[recId]?.[i] ?? '✨'}</span></span>
          : <span className="step-icon grid size-24 place-items-center rounded-full bg-card text-5xl" aria-hidden="true">{ICONS[recId]?.[i] ?? '✨'}</span>}
        <p className="text-sm font-semibold text-muted-foreground">Алхам {i + 1} / {steps.length}</p>
        <p className="font-bold" aria-live="polite">{steps[i]}</p>
      </div>
      <div className="mt-3 flex justify-center gap-1.5" aria-hidden="true">
        {steps.map((s, n) => <i key={s} className={cn('h-2 rounded-full bg-border transition-all duration-300', n === i ? 'w-6 bg-primary' : 'w-2', n < i && 'bg-primary/50')} />)}
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="xl" variant="secondary" className="flex-none" disabled={i === 0} aria-label="Өмнөх алхам" onClick={() => setI(i - 1)}>←</Button>
        {last ? <Button size="xl" className="flex-1" onClick={onFinish}>✓ Дууслаа</Button>
          : <Button size="xl" className="flex-1" onClick={() => setI(i + 1)}>Дараагийн алхам →</Button>}
      </div>
    </div>
  );
}
