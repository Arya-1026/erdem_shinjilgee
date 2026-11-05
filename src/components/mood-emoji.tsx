import { moodById } from '@/lib/data';
import { EMOJI_SVG } from '@/lib/emoji-svgs';
import type { MoodId } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Сэтгэл санааны эможи. Хөдөлгөөнт 3D SVG (public/emoji) байвал түүнийг, үгүй бол (ууртай) CSS хөдөлгөөнтэй эможи. */
export function MoodEmoji({ mood, className }: { mood: MoodId; className?: string }) {
  const m = moodById(mood);
  if (EMOJI_SVG[mood]) {
    // eslint-disable-next-line @next/next/no-img-element -- SVG анимаци next/image-ээр тоглохгүй
    return <img src={`/emoji/${mood}.svg`} alt={m.label} title={m.label} draggable={false} className={cn('inline-block size-[1.4em] align-middle', className)} />;
  }
  return <span role="img" aria-label={m.label} title={m.label} className={cn('mood-anim', `mood-anim-${mood}`, className)}>{m.emoji}</span>;
}
