import { moodById } from '@/lib/data';
import type { MoodId } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Сэтгэл санааны эможи, сэтгэл санаа бүрт өөр хөдөлгөөнтэй (баяртай бол үсэрнэ, түгшсэн бол чичирнэ…). CSS-ээр тул утсанд хөнгөн. */
export function MoodEmoji({ mood, className }: { mood: MoodId; className?: string }) {
  const m = moodById(mood);
  return <span role="img" aria-label={m.label} title={m.label} className={cn('mood-anim', `mood-anim-${mood}`, className)}>{m.emoji}</span>;
}
