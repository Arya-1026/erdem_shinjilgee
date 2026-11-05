'use client';

import { useMemo, useRef, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MOODS } from '@/lib/data';
import { EMOJI_SVG } from '@/lib/emoji-svgs';
import { cn } from '@/lib/utils';
import type { Mood } from '@/lib/types';
import CircularCarousel from './circular-carousel';
import { FaceSVG } from './mood-face';
import { useApp } from './providers/app-provider';

const N = MOODS.length;
const ARROWS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End']);

/** CircularCarousel зөвхөн зураг харуулдаг тул mood-ийн картыг SVG зураг болгоно:
 *  өнгөт дэвсгэр + өөрийн зураг / 2D дүр / emoji + нэр */
function cardSrc(m: Mood, art: string, img?: string) {
  const face = img
    ? `<clipPath id="c"><circle cx="220" cy="190" r="118"/></clipPath><image href="${img}" x="102" y="72" width="236" height="236" clip-path="url(#c)" preserveAspectRatio="xMidYMid slice"/>`
    : art === 'art'
      ? renderToStaticMarkup(<FaceSVG m={m} />).replace('<svg', '<svg x="94" y="64" width="252" height="252"')
      : EMOJI_SVG[m.id]
        ? EMOJI_SVG[m.id]!.replace('<svg', '<svg x="70" y="40" width="300" height="300"')
        : `<text x="220" y="262" font-size="200" text-anchor="middle">${m.emoji}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 440" width="440" height="440">`
    + `<rect width="440" height="440" fill="${m.color}"/><circle cx="220" cy="190" r="130" fill="#fff" opacity=".35"/>${face}`
    + `<text x="220" y="392" font-family="Nunito, 'Segoe UI', sans-serif" font-size="48" font-weight="800" fill="#2B2724" text-anchor="middle">${m.label}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/* React Bits-ийн CircularCarousel (default тохиргоогоор) дээр mood сонгоно. Урд ирсэн карт идэвхтэй.
   Хэрэглэгч хөндөх хүртэл өөрөө эргэнэ. Хөндсөний дараа эргэлт зогсож сонголт нь хэвээр үлдэнэ. */
export function MoodCarousel({ index, onChange }: { index: number; onChange: (i: number, byUser: boolean) => void }) {
  const { profile } = useApp();
  // Carousel 0-р картаас эхэлдэг тул эхний mood урд ирэхээр жагсаалтыг эргүүлнэ
  const [start] = useState(index);
  const [auto, setAuto] = useState(true);
  const touched = useRef(false);
  const user = () => { touched.current = true; setAuto(false); };

  const items = useMemo(() => Array.from({ length: N }, (_, k) => {
    const m = MOODS[(start + k) % N];
    return { src: cardSrc(m, profile.art_mode, profile.mood_images?.[m.id]), alt: m.label, title: m.label };
  }), [start, profile.art_mode, profile.mood_images]);

  return (
    <>
      <div className="-mx-[18px] mt-1 h-[260px]" onPointerDown={user} onKeyDown={e => { if (ARROWS.has(e.key)) user(); }}>
        <CircularCarousel items={items} autoplay={auto ? 'drift' : 'off'}
          onChange={i => onChange((start + i) % N, touched.current)} onItemClick={user} />
      </div>
      <div className="car-dots mb-1.5 flex justify-center gap-1.5" aria-hidden="true">{MOODS.map((m, i) => <i key={m.id} className={cn(i === index && 'on')} />)}</div>
    </>
  );
}
