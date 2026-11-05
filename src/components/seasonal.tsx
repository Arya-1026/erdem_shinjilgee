'use client';

import { useSyncExternalStore } from 'react';
import { today } from '@/lib/date';
import { loadSeasonPref, resolveSeason, SEASONS, type SeasonPref } from '@/lib/season';
import { cn } from '@/lib/utils';
import { useApp } from './providers/app-provider';
import { useT } from '@/components/providers/locale-provider';

const subscribe = (cb: () => void) => {
  addEventListener('setgel-season', cb); addEventListener('storage', cb);
  return () => { removeEventListener('setgel-season', cb); removeEventListener('storage', cb); };
};
/** localStorage-д хадгалсан сонголт. Сервер дээр 'off' гэж үзэж hydration зөрөхгүй байлгана. */
export const useSeasonPref = () => useSyncExternalStore<SeasonPref>(subscribe, loadSeasonPref, () => 'off');

const useSeason = () => {
  const pref = useSeasonPref();
  // Prerender-т одоогийн цаг уншиж болохгүй (Cache Components): сервер дээр огноогүй, 'off' сонголттой
  const date = useSyncExternalStore(() => () => {}, today, () => '1970-01-01');
  return resolveSeason(pref, new Date(date + 'T12:00'));
};

// Цасан ширхэг: тогтмол утга (render бүрт солигдохгүй)
const FLAKES = Array.from({ length: 12 }, (_, i) => ({ left: (i * 37) % 96, size: 3 + (i % 3), dur: 7 + ((i * 13) % 6), delay: -((i * 11) % 9) }));

/* Зүүн цэсний доод хоосон хэсэгт Шинэ жилийн жижиг хөдөлгөөнтэй үзэгдэл (зөвхөн том дэлгэцэд).
   Хэрэглэгч гунигтай, түгшсэн, уурласан үед бүдгэрч, тайван болно. */
export function SeasonalNav() {
  const season = useSeason();
  const { activeMood } = useApp();
  if (season !== 'newyear') return null;
  const soft = ['sad', 'anxious', 'angry'].includes(activeMood.id);

  return (
    <div className={cn('xmas relative mt-auto hidden h-[330px] shrink-0 overflow-hidden rounded-2xl desk:block', soft && 'soft')} aria-hidden>
      {FLAKES.map((f, i) => (
        <i key={i} className="xm-flake" style={{ left: `${f.left}%`, width: f.size, height: f.size, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s` }} />
      ))}
      <span className="xm-star" style={{ left: '12%', top: 18 }}>✨</span>
      <span className="xm-star" style={{ left: '78%', top: 40, animationDelay: '-1.2s' }}>✨</span>

      {/* Цаа бугатай чарга дээр бэлэгтэй өвгөн тэнгэрээр нисэнэ */}
      <div className="xm-sleigh"><span>🦌</span><span>🦌</span><span className="relative">🛷<b>🎅</b><em>🎁</em></span></div>

      {/* Халдаг зуух: гал, оймс, тавцан дээр халуун шоколад, сүү, жигнэмэг */}
      <div className="xm-fire">
        <div className="xm-mantle">
          <span className="xm-cup">☕<i /><i /></span><span className="text-[15px]">🥛</span><span className="text-[13px]">🍪</span>
        </div>
        <div className="xm-sock" style={{ left: 8 }}>🧦</div>
        <div className="xm-sock" style={{ left: 40, animationDelay: '-.8s' }}>🧦</div>
        <div className="xm-hearth"><span className="xm-flame">🔥</span></div>
      </div>

      <span className="xm-candy" style={{ left: '44%', bottom: 66 }}>🍬</span>
      <span className="xm-candy" style={{ left: '30%', bottom: 18, animationDelay: '-2s' }}>🍭</span>
      <span className="xm-snowman">⛄</span>
      <span className="xm-tree">🎄</span>
      <span className="xm-gift" style={{ right: 52 }}>🎁</span>
      <span className="xm-gift" style={{ right: 8, animationDelay: '-.6s' }}>🎁</span>
      <div className="xm-ground" />
    </div>
  );
}

/* Өвлийн өвгөний малгай: эцэг элемент нь `relative` байх ёстой */
export function SantaHat({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const season = useSeason();
  if (season !== 'newyear') return null;
  return (
    <svg viewBox="0 0 24 20" className={cn('santa-hat', className)} style={style} aria-hidden>
      <path d="M3 16 C6 7 11 2 18 3 C16 6 15 10 16 15 Z" fill="#d93a3a" />
      <rect x="1" y="14" width="18" height="5" rx="2.5" fill="#fff" />
      <circle cx="19.5" cy="3.5" r="3" fill="#fff" />
    </svg>
  );
}

/* Картын буланд жижиг чимэглэл (график зэрэг сул зайтай газар). Эцэг нь `relative`. */
export function SeasonalCorner({ items = ['❄️', '🎄'] }: { items?: string[] }) {
  const season = useSeason();
  if (season !== 'newyear') return null;
  return <span className="xm-corner" aria-hidden>{items.map((c, i) => <i key={i} style={{ animationDelay: `${-i * .7}s` }}>{c}</i>)}</span>;
}

/* Нүүр хуудсанд улирлын мэндчилгээ */
export function SeasonalGreeting() {
  const tr = useT();
  const season = useSeason();
  if (!season) return null;
  return <p className="seasonal-greet mt-2 inline-block rounded-full px-3.5 py-1.5 text-sm font-semibold">{tr(SEASONS[season].greeting)}</p>;
}
