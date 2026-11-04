'use client';

import { useApp } from '@/components/providers/app-provider';
import { cn } from '@/lib/utils';
import type { Mood } from '@/lib/types';

const INK = '#2D2440';
const MOUTHS: Record<string, string> = { happy: 'M14 27 Q24 38 34 27', calm: 'M16 28 Q24 33 32 28', neutral: 'M16 30 L32 30', tired: 'M19 31 Q24 29 29 31', anxious: 'M15 31 Q18 28 21 31 T27 31 T33 31', sad: 'M16 33 Q24 26 32 33', angry: 'M16 33 Q24 28 32 33' };

// 2D дүр (SVG)
export function FaceSVG({ m }: { m: Mood }) {
  const s = { stroke: INK, strokeLinecap: 'round' as const };
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="21" fill={m.color} />
      {m.id === 'angry' && <path d="M13 13L21 16.5M35 13L27 16.5" {...s} strokeWidth="2.5" />}
      {(m.id === 'anxious' || m.id === 'sad') && <path d="M13 15.5L20 13.5M35 15.5L28 13.5" {...s} strokeWidth="2" />}
      {m.id === 'tired' ? <path d="M14 20h7M27 20h7" {...s} strokeWidth="2.5" />
        : m.id === 'happy' || m.id === 'calm' ? <path d="M14 21Q17.5 17 21 21M27 21Q30.5 17 34 21" {...s} strokeWidth="2.5" fill="none" />
        : <><circle cx="17.5" cy="20" r="2.6" fill={INK} /><circle cx="30.5" cy="20" r="2.6" fill={INK} /></>}
      <path d={MOUTHS[m.id]} {...s} strokeWidth="2.5" fill="none" />
      {m.id === 'sad' && <path d="M33 24q2.5 4 0 6.5q-2.5-2.5 0-6.5z" fill="#3B82F6" />}
      {m.id === 'happy' && <><circle cx="11.5" cy="27" r="3" fill="#FF8FA3" opacity=".6" /><circle cx="36.5" cy="27" r="3" fill="#FF8FA3" opacity=".6" /></>}
      {m.id === 'tired' && <text x="35" y="11" fontSize="9" fontWeight="700" fill={INK}>z</text>}
      {m.id === 'anxious' && <path d="M38 12q2 3 0 5q-2-2 0-5z" fill="#60A5FA" />}
    </svg>
  );
}

// Хэрэглэгчийн өөрийн зураг → байхгүй бол профайлын тохиргоогоор emoji эсвэл 2D дүр харуулна. Хэмжээг className-ээр (size-*, text-*) өгнө.
export function MoodFace({ m, className }: { m: Mood; className?: string }) {
  const { profile } = useApp();
  const src = profile.mood_images?.[m.id];
  return (
    <span className={cn('face', className)} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element -- хэрэглэгчийн оруулсан data URL */}
      {src ? <img src={src} alt="" className="size-full rounded-full object-cover" /> : profile.art_mode === 'art' ? <FaceSVG m={m} /> : m.emoji}
    </span>
  );
}
