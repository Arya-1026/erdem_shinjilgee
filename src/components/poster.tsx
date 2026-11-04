'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

/* Киноны постер. Зураг ачаалагдахгүй бол 🎬 харуулна. */
export function Poster({ src, title, className }: { src?: string; title: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className={cn('grid place-items-center', className)} aria-hidden>🎬</span>;
  // eslint-disable-next-line @next/next/no-img-element -- гадны CDN-ийн зураг
  return <img src={src} alt={`${title} постер`} className={cn('object-cover', className)} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}
