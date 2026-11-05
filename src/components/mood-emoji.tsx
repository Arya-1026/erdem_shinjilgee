import { moodById } from '@/lib/data';
import type { MoodId } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useT } from '@/components/providers/locale-provider';

/** Сэтгэл санааны эможи, сэтгэл санаа бүрт өөр хөдөлгөөнтэй (баяртай бол үсэрнэ, түгшсэн бол чичирнэ…). CSS-ээр тул утсанд хөнгөн. */
export function MoodEmoji({ mood, className }: { mood: MoodId; className?: string }) {
  const tr = useT();
  const m = moodById(mood);
  return <span role="img" aria-label={tr(m.label)} title={tr(m.label)} className={cn('mood-anim', `mood-anim-${mood}`, className)}>{m.emoji}</span>;
}
