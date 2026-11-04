'use client';

import { useCallback, useEffect, useRef } from 'react';
import { MOODS } from '@/lib/data';
import { cn } from '@/lib/utils';
import { MoodFace } from './mood-face';

/* Хажуу тийш гүйлгэж mood сонгох carousel. Голд ирсэн карт идэвхтэй болно. */
export function MoodCarousel({ index, onChange }: { index: number; onChange: (i: number, byUser: boolean) => void }) {
  const car = useRef<HTMLDivElement>(null);
  const cur = useRef(index);

  const center = useCallback((i: number, smooth: boolean) => {
    const el = car.current, c = el?.children[i] as HTMLElement | undefined; if (!el || !c) return;
    el.scrollTo({ left: c.offsetLeft - (el.clientWidth - c.offsetWidth) / 2, behavior: smooth ? 'smooth' : 'instant' });
  }, []);

  // Эхлэхдээ сонгогдсон картыг голлуулна (хэрэглэгчийн үйлдэл гэж тооцохгүй)
  useEffect(() => { center(cur.current, false); }, [center]);

  useEffect(() => {
    const el = car.current; if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const mid = el.scrollLeft + el.clientWidth / 2;
        let best = 0, bestD = Infinity;
        [...el.children].forEach((c, j) => { const h = c as HTMLElement, d = Math.abs(h.offsetLeft + h.offsetWidth / 2 - mid); if (d < bestD) { bestD = d; best = j; } });
        if (best !== cur.current) { cur.current = best; onChange(best, true); }
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [onChange]);

  const step = (d: number) => {
    const i = Math.max(0, Math.min(MOODS.length - 1, cur.current + d));
    center(i, true);
    (car.current?.children[i] as HTMLElement | undefined)?.focus({ preventScroll: true });
  };

  return (
    <>
      <div className="relative -mx-[18px] mt-1">
        <button className="car-nav absolute top-1/2 left-2.5 z-2 size-[42px] -translate-y-1/2 rounded-full bg-card text-2xl shadow-[var(--shadow)]" aria-label="Өмнөх" onClick={() => step(-1)}>‹</button>
        <div ref={car} className="mood-car" role="listbox" aria-label="Сэтгэл хөдлөл сонгох"
          onKeyDown={e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1); } }}>
          {MOODS.map((m, i) => (
            <button key={m.id} role="option" aria-selected={i === index} aria-label={m.label} onClick={() => center(i, true)}
              className={cn('mcard', i === index && 'active')} style={{ '--c': m.color } as React.CSSProperties}>
              <MoodFace m={m} /><span>{m.label}</span>
            </button>
          ))}
        </div>
        <button className="car-nav absolute top-1/2 right-2.5 z-2 size-[42px] -translate-y-1/2 rounded-full bg-card text-2xl shadow-[var(--shadow)]" aria-label="Дараах" onClick={() => step(1)}>›</button>
      </div>
      <div className="car-dots mb-1.5 flex justify-center gap-1.5" aria-hidden="true">{MOODS.map((m, i) => <i key={m.id} className={cn(i === index && 'on')} />)}</div>
    </>
  );
}
