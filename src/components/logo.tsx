'use client';

import { useId } from 'react';
import { cn } from '@/lib/utils';
import { SantaHat } from './seasonal';

/* «Сэтгэл» лого: эхний «С» үсэг нь хавирган сар, нээлттэй талд нь жижиг од анивчина.
   Хэмжээ нь font-size-аар (em) тохирно. Шинэ жилийн үеэр сар малгай өмсөнө. */
export function Logo({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <span role="img" aria-label="Сэтгэл" className={cn('logo inline-flex items-baseline font-extrabold leading-none tracking-tight', className)}>
      <span className="logo-moon relative mr-[.04em] inline-block h-[.98em] w-[.84em] translate-y-[.1em]" aria-hidden>
        <svg viewBox="0 0 24 26" className="size-full overflow-visible">
          <defs>
            <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#FFE9A8" />
              <stop offset="1" style={{ stopColor: 'var(--primary)' }} />
            </linearGradient>
            <mask id={`m${id}`}>
              <rect width="24" height="26" fill="#fff" />
              <circle cx="17" cy="11.5" r="8" fill="#000" />
            </mask>
          </defs>
          <circle cx="11.5" cy="13" r="11.5" fill={`url(#g${id})`} mask={`url(#m${id})`} />
          <path className="logo-star" d="M18.5 9l1.1 2.6 2.6 1.1-2.6 1.1-1.1 2.6-1.1-2.6-2.6-1.1 2.6-1.1z" fill="#FFE9A8" />
        </svg>
        <SantaHat style={{ top: '-.3em', left: '-.14em', width: '.6em', height: '.5em' }} />
      </span>
      <span aria-hidden>этгэл</span>
    </span>
  );
}
