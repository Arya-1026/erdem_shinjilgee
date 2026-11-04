'use client';

import { PALETTES, type PaletteId } from '@/lib/palettes';
import { cn } from '@/lib/utils';

/* Апп-ын үндсэн өнгө сонгох. Карт бүр жижиг "урьдчилан харах" (товч, chip, дэвсгэр) агуулна. */
export function PalettePicker({ value, onChange, compact }: { value: PaletteId; onChange: (id: PaletteId) => void; compact?: boolean }) {
  return (
    <div role="radiogroup" aria-label="Апп-ын өнгө" className={cn('grid gap-3', compact ? 'grid-cols-5' : 'grid-cols-1 sm:grid-cols-2')}>
      {PALETTES.map(p => {
        const on = value === p.id;
        if (compact) return (
          <button key={p.id} type="button" role="radio" aria-checked={on} aria-label={p.label} title={p.label} onClick={() => onChange(p.id)}
            className={cn('flex flex-col items-center gap-1 rounded-2xl border p-2 text-xs transition', on ? 'border-foreground' : 'border-border')}>
            <span className="grid size-9 place-items-center rounded-full text-sm text-white" style={{ background: p.primary }}>{on ? '✓' : ''}</span>
            <span className="truncate">{p.label}</span>
          </button>
        );
        return (
          <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => onChange(p.id)}
            className={cn('flex items-center gap-3.5 rounded-2xl border bg-card p-3.5 text-left transition', on ? 'border-2 border-foreground' : 'border-border hover:border-foreground/40')}>
            {/* Урьдчилан харах: дэвсгэр + гол өнгийн товч + сэтгэл хөдлөлийн цэгүүд */}
            <span className="relative grid h-16 w-20 flex-none place-items-center overflow-hidden rounded-xl" style={{ background: `linear-gradient(180deg, ${p.soft}, #FAF8F5)` }} aria-hidden="true">
              <span className="rounded-lg px-2.5 py-1 text-[11px] font-bold text-white" style={{ background: p.primary }}>Хадгалах</span>
              <span className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 gap-1">
                {['#F9D77E', '#A8D8C9', '#9DB4D9'].map(c => <i key={c} className="block size-2 rounded-full" style={{ background: c }} />)}
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <b className="block">{p.label}</b>
              <span className="text-sm text-muted-foreground">{p.desc}</span>
            </span>
            <span className={cn('grid size-6 flex-none place-items-center rounded-full border-2 text-xs text-white', on ? 'border-transparent' : 'border-border')} style={on ? { background: p.primary } : undefined}>
              {on && '✓'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
