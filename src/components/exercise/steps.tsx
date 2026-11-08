'use client';

import { useEffect, useRef, useState } from 'react';
import type { AnimId } from '@/lib/exercise-moves';
import { CharacterPicker, useCharacter } from './character';
import { Stage } from './coach';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { expandSteps, stepSeconds } from '@/lib/exercise-benefits';
import { useT } from '@/components/providers/locale-provider';

// Алхам бүрийн дүрс. Биеийн хөдөлгөөнгүй дасгалуудад алхам алхмаар хөдөлгөөнт дүрсээр харуулна.
const ICONS: Record<string, string[]> = {
  e2: ['👀', '✋', '👂', '👃', '👅'],
  e5: ['✍️', '💭'],
  e8: ['🖍️', '🎨', '🏷️'],
  e9: ['📝', '🎯', '💬', '⏱️'],
  e10: ['📝', '🗣️', '🤲', '🕰️', '👂'],
  e11: ['🪑', '🌬️', '⏸️', '😮‍💨', '🔁'],
  e12: ['🛏️', '🦶', '🦵', '🍃', '😌'],
  e13: ['🚰', '💦', '🖐️', '🌬️'],
  e14: ['📝', '🤗', '💌', '💛'],
  e15: ['📵', '🕯️', '📝', '🌬️', '🌙'],
  e16: ['🎵', '🙆', '💃', '🙌'],
  e17: ['💭', '✅', '❌', '🤝', '⚖️'],
  e18: ['🪑', '🙇', '🙆', '✋', '🚶'],
  e19: ['👤', '💬', '📸', '📅'],
  e20: ['✨', '👀', '😊', '🌞'],
};
// Алхам бүрт 3D дүр юу хийхийг (сүүлийнх нь үлдсэн алхмуудад давтагдана) ба нэг давталтын секунд
const STEP_ANIMS: Record<string, AnimId[]> = {
  e2: ['lookAround'], e8: ['idle', 'write', 'think'], e9: ['write', 'think', 'write', 'write', 'sitBreath'], e10: ['write', 'talk', 'talk', 'think', 'talk'],
  e11: ['sitBreath', 'boxBreath'], e12: ['sitBreath'], e13: ['walk', 'washFace', 'washFace', 'idle'], e14: ['write', 'think', 'write', 'sitBreath'],
  e15: ['idle', 'idle', 'write', 'sitBreath', 'sitBreath'], e16: ['think', 'dance', 'dance', 'stretchUp'], e17: ['write', 'think', 'think', 'think', 'write'],
  e18: ['shoulderRoll', 'neckTilt', 'stretchUp', 'idle', 'walk'], e19: ['think', 'write', 'write', 'wave'], e20: ['think', 'sitBreath', 'cheer', 'cheer'],
};
// Бичих, бодох дасгалд 3D дүр шаардлагагүй: зөвхөн тоолуур, дүрс
const NO_STAGE = new Set(['e8', 'e14', 'e17']);
const PERIOD: Partial<Record<AnimId, number>> = { walk: 1.2, dance: 1.6, cheer: 1.2, neckTilt: 8, shoulderRoll: 4, boxBreath: 16, lookAround: 6, washFace: 1.5, wave: 1, talk: 2, write: 2 };
const animAt = (id: string, step: number, round: number): AnimId => {
  const list = STEP_ANIMS[id] ?? ['idle'];
  if (id === 'e11') return round ? 'boxBreath' : 'sitBreath';
  return list[Math.min(step, list.length - 1)];
};

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.ceil(s) % 60).padStart(2, '0')}`;

/** Алхам солигдоход богино дохио (хэрэглэгч товч дарсны дараа л дуугарна) */
function useChime() {
  const ctx = useRef<AudioContext | null>(null);
  useEffect(() => () => { void ctx.current?.close(); }, []);
  return {
    unlock: () => { try { ctx.current ??= new AudioContext(); void ctx.current.resume(); } catch { /* дуугүй */ } },
    play: () => {
      const c = ctx.current;
      navigator.vibrate?.(60);
      if (!c) return;
      const o = c.createOscillator(), g = c.createGain();
      o.frequency.value = 660;
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, c.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.5);
      o.connect(g).connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.55);
    },
  };
}

/* Алхам алхмаар, бодит цагт дагуулна: алхам бүрт тоолуур, хугацаа дуусахад дараагийнх руу автоматаар шилжинэ */
export function StepCoach({ recId, steps, sub, onFinish }: { recId: string; steps: string[]; sub: string; onFinish: () => void }) {
  const tr = useT();
  const plan = expandSteps(recId, steps, stepSeconds(steps, sub));
  const total = plan.reduce((s, p) => s + p.sec, 0);
  const [status, setStatus] = useState<'ready' | 'run' | 'pause'>('ready');
  const [i, setI] = useState(0);
  const [t, setT] = useState(0);
  const chime = useChime();
  const p = plan[i], last = i === plan.length - 1;

  const go = (n: number) => {
    if (n >= plan.length) return onFinish();
    setI(Math.max(0, n));
    setT(0);
  };
  if (status === 'run' && t >= p.sec) { chime.play(); go(i + 1); }

  useEffect(() => {
    if (status !== 'run') return;
    let at = performance.now();
    const id = setInterval(() => { const now = performance.now(), dt = (now - at) / 1000; at = now; setT(x => x + dt); }, 200);
    return () => clearInterval(id);
  }, [status]);

  // Дасгал хийж байх хооронд дэлгэц унтрахгүй
  useEffect(() => {
    if (status !== 'run') return;
    const lock = navigator.wakeLock?.request('screen').catch(() => null);
    return () => { void lock?.then(l => l?.release()); };
  }, [status]);

  const icon = ICONS[recId]?.[recId === 'e11' ? (p.round ? 1 + (i - 1) % 4 : 0) : i] ?? '✨';
  const left = Math.max(0, p.sec - t), R = 52, C = 2 * Math.PI * R;
  const character = useCharacter();
  const anim = animAt(recId, i, p.round);
  // Хайрцаг амьсгал: тойрог бүрийн эхэнд хөдөлгөөн шинээр эхэлж үе шаттай таарна
  const cycle = recId === 'e11' ? p.round : i;
  const spent = plan.slice(0, i).reduce((s, x) => s + x.sec, 0) + Math.min(t, p.sec);

  const stage = !NO_STAGE.has(recId);

  if (status === 'ready') return (
    <div className="mt-3">
      {stage && <div className="relative h-[min(36dvh,260px)] overflow-hidden rounded-[18px] bg-[linear-gradient(180deg,var(--secondary),color-mix(in_srgb,var(--secondary)_55%,var(--card)))]">
        <Stage anim={animAt(recId, 0, 0)} cycle={-1} period={PERIOD[animAt(recId, 0, 0)] ?? 4} running view="front" character={character} />
        <CharacterPicker className="absolute top-2.5 right-2.5" />
      </div>}
      <div className={cn('flex items-center gap-3 rounded-[18px] bg-secondary p-3', stage && 'mt-3')}>
        <span className="step-icon grid size-12 flex-none place-items-center rounded-full bg-card text-2xl" aria-hidden="true">{ICONS[recId]?.[0] ?? '✨'}</span>
        <p className="text-sm">{tr('Алхам бүр тоолууртай. Хугацаа дуусахад дохио өгч дараагийнх руу автоматаар шилжинэ. Нийт {0} мин.', Math.max(1, Math.round(total / 60)))}</p>
      </div>
      <ol className="mt-3 list-decimal pl-5 text-sm">{steps.map(s => <li key={s} className="mb-1">{tr(s)}</li>)}</ol>
      <Button size="xl" className="mt-3 w-full" onClick={() => { chime.unlock(); setStatus('run'); }}>{tr('▶ Дагаж эхлэх')}</Button>
    </div>
  );

  return (
    <div className="mt-3">
      {stage ? <div className="relative h-[min(40dvh,300px)] overflow-hidden rounded-[18px] bg-[linear-gradient(180deg,var(--secondary),color-mix(in_srgb,var(--secondary)_55%,var(--card)))]">
        <Stage anim={anim} cycle={cycle} period={PERIOD[anim] ?? 4} running={status === 'run'} view={anim === 'walk' ? 'angle' : 'front'} character={character} />
        <div className="pointer-events-none absolute inset-x-0 top-2.5 flex items-start justify-between px-3 text-sm font-bold">
          <span className="rounded-full bg-background/85 px-2.5 py-1">{p.round ? tr('{0} / {1} давталт', p.round, p.rounds) : tr('Алхам {0} / {1}', i + 1, plan.length)}</span>
          {/* Тоолуур: цагираг алхмын хугацаагаар дүүрнэ */}
          <span className="relative grid size-14 place-items-center rounded-full bg-background/85" aria-label={tr('Үлдсэн хугацаа')}>
            <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden="true">
              <circle cx="60" cy="60" r={R} fill="none" strokeWidth="9" className="stroke-secondary" />
              <circle cx="60" cy="60" r={R} fill="none" strokeWidth="9" strokeLinecap="round" className="stroke-primary transition-[stroke-dashoffset] duration-200 ease-linear"
                strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, t / p.sec))} />
            </svg>
            <b className="text-sm tabular-nums">{clock(left)}</b>
          </span>
        </div>
      </div> : (
        // 3D-гүй: том цагираг тоолуур, дотор нь алхмын дүрс
        <div className="flex flex-col items-center gap-2 rounded-[18px] bg-secondary p-5 text-center">
          <div className="relative grid size-[150px] place-items-center">
            <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden="true">
              <circle cx="60" cy="60" r={R} fill="none" strokeWidth="6" className="stroke-card" />
              <circle cx="60" cy="60" r={R} fill="none" strokeWidth="6" strokeLinecap="round" className="stroke-primary transition-[stroke-dashoffset] duration-200 ease-linear"
                strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, t / p.sec))} />
            </svg>
            <span key={i} className="step-icon grid size-[96px] place-items-center rounded-full bg-card text-5xl" aria-hidden="true">{icon}</span>
          </div>
          <b className="text-3xl tabular-nums" aria-label={tr('Үлдсэн хугацаа')}>{clock(left)}</b>
          <p className="text-sm font-semibold text-muted-foreground">{tr('Алхам {0} / {1}', i + 1, plan.length)}</p>
        </div>
      )}
      <div key={i} className="step-card mt-3 flex items-center gap-3 rounded-[18px] bg-secondary p-3">
        <span className="step-icon grid size-12 flex-none place-items-center rounded-full bg-card text-2xl" aria-hidden="true">{icon}</span>
        <p className="min-h-12 flex-1 font-bold" aria-live="polite">{tr(p.text)}</p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label={tr('Дасгалын явц')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((spent / total) * 100)}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${(spent / total) * 100}%` }} />
      </div>
      {plan[i + 1] && <p className="mt-1.5 truncate text-xs text-muted-foreground">{tr('Дараагийнх: {0}', tr(plan[i + 1].text))}</p>}
      <div className="mt-3 flex gap-2">
        <Button size="xl" variant="secondary" className="flex-none" disabled={i === 0} aria-label={tr('Өмнөх алхам')} onClick={() => go(i - 1)}>⏮</Button>
        <Button size="xl" className="flex-1" onClick={() => setStatus(status === 'run' ? 'pause' : 'run')}>{status === 'run' ? tr('⏸ Түр зогсоох') : tr('▶ Үргэлжлүүлэх')}</Button>
        <Button size="xl" variant="secondary" className="flex-none" aria-label={last ? tr('✓ Дууслаа') : tr('Дараагийн алхам')} onClick={() => go(i + 1)}>{last ? '✓' : '⏭'}</Button>
      </div>
    </div>
  );
}
