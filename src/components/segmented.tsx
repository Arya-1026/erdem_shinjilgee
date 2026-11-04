'use client';

import { cn } from '@/lib/utils';

// Segmented control (горим, хугацааны сонголт гэх мэт)
export function Segmented<T extends string | number>({ value, onChange, options, full, className, label }: {
  value: T;
  onChange: (v: T) => void;
  options: [T, React.ReactNode][];
  full?: boolean;
  className?: string;
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex max-w-full gap-0.5 overflow-x-auto rounded-xl border bg-background p-[3px] no-scrollbar', full && 'flex w-full', className)}>
      {options.map(([k, l]) => (
        <button key={String(k)} type="button" role="radio" aria-checked={value === k} onClick={() => onChange(k)}
          className={cn('min-h-9 rounded-[9px] px-3 text-sm whitespace-nowrap text-muted-foreground transition', full && 'flex-1',
            value === k && 'bg-card font-semibold text-foreground shadow-[0_1px_4px_rgba(0,0,0,.08)]')}>
          {l}
        </button>
      ))}
    </div>
  );
}

// Chip товч (таг, хобби, шүүлтүүр)
export function Chip({ on, className, style, ...props }: React.ComponentProps<'button'> & { on?: boolean }) {
  return (
    <button type="button" aria-pressed={on} style={style}
      className={cn('inline-flex min-h-[38px] flex-none items-center gap-1.5 rounded-full border-[1.5px] bg-card px-3.5 text-sm whitespace-nowrap transition hover:border-primary',
        on && 'border-primary bg-primary text-primary-foreground', className)}
      {...props} />
  );
}
