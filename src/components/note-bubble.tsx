import { MoodEmoji } from '@/components/mood-emoji';
import { moodById } from '@/lib/data';
import type { MoodId } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useT } from '@/components/providers/locale-provider';

/** Аватарын дээрх бөмбөлөг (Messenger-ийн байршил хуваалцах бөмбөлөг шиг):
 *  1-р мөр: хөдөлгөөнтэй эможи + сэтгэл санааны нэр (тод), 2-р мөр: бодол эсвэл хэзээ бүртгэсэн. */
export function NoteBubble({ mood, sub, placeholder, className }: { mood?: MoodId | null; sub?: string | null; placeholder?: string; className?: string }) {
  const tr = useT();
  const m = mood ? moodById(mood) : null;
  return (
    <span className={cn('pointer-events-none absolute -top-[46px] left-1/2 z-[1] w-max max-w-[104px] -translate-x-1/2 text-left', className)}>
      <span className="block rounded-[14px] bg-zinc-800/95 px-2.5 py-1.5 text-white shadow-lg ring-1 ring-white/10 backdrop-blur-sm">
        {m ? (
          <span className="flex items-center gap-1 text-[.78rem] leading-tight font-bold">
            <MoodEmoji mood={m.id} className="flex-none text-[.95rem]" />
            <span className="truncate">{tr(m.label)}</span>
          </span>
        ) : <span className="block text-[.75rem] leading-tight font-semibold text-white/80">{placeholder}</span>}
        {m && sub && <span className="mt-px block truncate text-[.7rem] leading-tight text-white/85">{sub}</span>}
      </span>
      {/* «хөөс»-ний сүүл: доод зүүн буланд жижиг дугуй */}
      <i className="absolute -bottom-1.5 left-3 size-2.5 rounded-full bg-zinc-800/95" />
    </span>
  );
}

/** Аватарыг сэтгэл санааны өнгөтэй том дугуй дэвсгэр дээр тавина */
export function MoodHalo({ mood, children, className }: { mood?: MoodId | null; children: React.ReactNode; className?: string }) {
  return (
    <span className={cn('grid size-[72px] flex-none place-items-center rounded-full transition-colors', className)}
      style={{ background: mood ? `radial-gradient(circle, ${moodById(mood).color} 0 55%, color-mix(in srgb, ${moodById(mood).color} 45%, transparent) 100%)` : 'var(--secondary)' }}>
      {children}
    </span>
  );
}
