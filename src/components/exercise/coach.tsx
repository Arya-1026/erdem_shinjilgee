'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { CharacterPicker, useCharacter } from './character';
import { Button } from '@/components/ui/button';
import { cueAt, moveSeconds, PREP_SECONDS, totalSeconds, type Move } from '@/lib/exercise-moves';
import { useT } from '@/components/providers/locale-provider';
import { createNatureMusic, type NatureMusic } from '@/lib/nature-music';

// three.js том тул зөвхөн дасгал нээхэд ачаална
export const Stage = dynamic(() => import('./stage'), {
  ssr: false,
  loading: () => <div className="grid size-full place-items-center text-4xl" aria-hidden="true">🐾</div>,
});

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

type Status = 'ready' | 'run' | 'pause' | 'done';

// Байгалийн тайвшруулах аятай дасгалууд (иогийн сунгалт)
const NATURE_MUSIC = new Set(['e4']);
const SOUND_KEY = 'setgel-yoga-sound';

/* Дасгалыг 3D дүр (муур, туулай, хүн)-тэй хамт алхам алхмаар бодит цагт дагуулна. Хөдөлгөөн бүрийн өмнө 3 секунд бэлдэнэ.
   Утсан дээр Stage нь нягтрал, сүүдрийг багасгаж ажилладаг. */
export function ExerciseCoach({ recId, moves, onFinish }: { recId: string; moves: Move[]; onFinish: () => void }) {
  const tr = useT();
  const [status, setStatus] = useState<Status>('ready');
  const [i, setI] = useState(0);
  const [t, setT] = useState(-PREP_SECONDS);
  const m = moves[i];
  const withMusic = NATURE_MUSIC.has(recId);
  const [sound, setSound] = useState(() => { try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; } });
  const music = useRef<NatureMusic | null>(null);
  const character = useCharacter();
  const [noWebGL, setNoWebGL] = useState(false);

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

  // Ая: зогсоовол хамт зогсоно, дуусахад/хаахад унтарна
  useEffect(() => {
    const mu = music.current;
    if (!mu) return;
    if (status === 'pause') mu.pause();
    else if (status === 'run') mu.resume();
    else if (status === 'done') { mu.stop(); music.current = null; }
  }, [status]);
  useEffect(() => () => { music.current?.stop(); }, []);
  // Дараагийн дасгал руу шилжихэд хоёр нотын хонх, давталт бүрийн эхэнд аккорд «амьсгал авна»
  const firstMove = useRef(true);
  useEffect(() => { if (firstMove.current) { firstMove.current = false; return; } music.current?.step(); }, [i]);
  useEffect(() => { if (status === 'run' && !prep) music.current?.rep(); }, [status, prep, rep, i]);

  function begin() {
    // Товч дарсан мөчид эхлүүлнэ: хөтөч дууг зөвхөн хэрэглэгчийн үйлдлээр зөвшөөрдөг
    if (withMusic && !music.current) {
      music.current = createNatureMusic({ volume: sound ? 0.9 : 0 });
      music.current?.start();
    }
    setStatus('run');
  }
  function toggleSound() {
    const on = !sound;
    setSound(on);
    try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* хувийн цонх */ }
    music.current?.setVolume(on ? 0.9 : 0);
  }
  const count = m.hold ? clock(Math.max(0, Math.ceil(moveSeconds(m) - Math.max(0, t)))) : `${rep} / ${m.reps}`;
  const cue = cueAt(m, Math.max(0, t));
  const spent = moves.slice(0, i).reduce((s, x) => s + moveSeconds(x) + PREP_SECONDS, 0) + t + PREP_SECONDS;
  const total = totalSeconds(moves);

  return (
    <div className="mt-3 min-w-0">
      <div className="relative h-[min(44dvh,340px)] overflow-hidden rounded-[18px] bg-[linear-gradient(180deg,var(--secondary),color-mix(in_srgb,var(--secondary)_55%,var(--card)))]">
        {noWebGL ? <p className="grid size-full place-items-center p-6 text-center text-sm text-muted-foreground">{tr('Таны төхөөрөмж 3D дэмжихгүй байна. Доорх зааврыг дагаарай.')}</p>
          : <Stage anim={done ? 'cheer' : m.anim} cycle={ready ? -1 : i} period={done ? 1.2 : m.period} running={status === 'run' ? !prep : ready || done} view={done ? 'front' : m.view} character={character} onFail={() => setNoWebGL(true)} />}
        {(ready || done) && <CharacterPicker className="absolute top-2.5 right-2.5" />}
        {!ready && !done && (
          <div className="pointer-events-none absolute inset-x-0 top-2.5 flex items-start justify-between px-3 text-sm font-bold">
            <span className="rounded-full bg-background/80 px-2.5 py-1">{i + 1} / {moves.length}</span>
            {!prep && <span className="rounded-full bg-background/80 px-2.5 py-1 tabular-nums" aria-label={m.hold ? tr('Үлдсэн хугацаа') : tr('Давталт')}>{count}</span>}
          </div>
        )}
        {status === 'run' && (prep || cue) && (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 text-center">
            <span className="rounded-full bg-primary px-4 py-1.5 text-lg font-extrabold text-primary-foreground tabular-nums">{prep ? tr('Бэлдээрэй · {0}', Math.ceil(-t)) : cue}</span>
          </div>
        )}
      </div>

      {done ? (
        <>
          <p className="mt-3 text-center font-bold">{tr('Сайн байна 🌿 Дасгал дууслаа')}</p>
          <Button size="xl" className="mt-3 w-full" onClick={onFinish}>{tr('✓ Дууслаа')}</Button>
        </>
      ) : ready ? (
        <>
          <p className="mt-3 text-sm text-muted-foreground">{tr('Дүрээ сонгоод, түүнийг дагаж хамт хийгээрэй. Чирж өөр өнцгөөс харж болно. Нийт {0} мин.', Math.ceil(total / 60))}</p>
          <ol className="mt-2 list-decimal pl-5 text-sm">{[...new Set(moves.map(x => x.label))].map(l => <li key={l} className="mb-1">{tr(l)}</li>)}</ol>
          <Button size="xl" className="mt-3 w-full" onClick={begin}>{tr('▶ Дагаж эхлэх')}</Button>
        </>
      ) : (
        <>
          <p className="mt-3 min-h-12 font-bold" aria-live="polite">{tr(m.label)}</p>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label={tr('Дасгалын явц')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((spent / total) * 100)}>
            <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${(spent / total) * 100}%` }} />
          </div>
          {moves[i + 1] && <p className="mt-1.5 truncate text-xs text-muted-foreground">{tr('Дараагийнх: {0}', moves[i + 1].label)}</p>}
          <div className="mt-3 flex gap-2">
            <Button size="xl" variant="secondary" className="flex-none" disabled={i === 0} aria-label={tr('Өмнөх алхам')} onClick={() => go(i - 1)}>⏮</Button>
            <Button size="xl" className="flex-1" onClick={() => setStatus(status === 'run' ? 'pause' : 'run')}>{status === 'run' ? tr('⏸ Түр зогсоох') : tr('▶ Үргэлжлүүлэх')}</Button>
            <Button size="xl" variant="secondary" className="flex-none" aria-label={tr('Дараагийн алхам')} onClick={() => go(i + 1)}>⏭</Button>
          </div>
        </>
      )}
      {withMusic && !done && (
        <button type="button" onClick={toggleSound} aria-pressed={sound}
          className="mx-auto mt-2 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-secondary">
          <span aria-hidden="true">{sound ? '🔔' : '🔕'}</span>{sound ? tr('Байгалийн ая асаалттай') : tr('Байгалийн ая унтраалттай')}
        </button>
      )}
    </div>
  );
}
