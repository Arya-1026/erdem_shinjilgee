'use client';

import { useEffect, useRef, useState } from 'react';
import { applyPalette, customPalette, paletteColors, PALETTE_GROUPS, PALETTES, type PaletteId } from '@/lib/palettes';
import { cn } from '@/lib/utils';
import { Switch } from './ui/switch';

const swatch = (from: string, to: string, kind?: string) => (kind === 'bold' ? from : `linear-gradient(135deg, ${from}, ${to})`);

/* Апп-ын өнгө сонгох: зөөлөн, градиент, гүн тод, өөрийн өнгө. Сонгосон даруйд бүх системд хэрэглэгдэнэ. */
export function PalettePicker({ value, onChange }: { value: PaletteId; onChange: (id: PaletteId) => void }) {
  const isCustom = value.startsWith('custom:');
  const cur = paletteColors(value);
  const [from, setFrom] = useState(isCustom ? cur.from : '#6a4fd8');
  const [to, setTo] = useState(isCustom && value.split(':').length > 2 ? cur.to : '#f72585');
  const [two, setTwo] = useState(!isCustom || value.split(':').length > 2);
  const save = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(save.current), []);

  // Өнгө чирж сонгох үед дэлгэцэн дээр шууд харуулж, зогссоны дараа л хадгална
  function pick(a: string, b: string, gradient: boolean) {
    setFrom(a); setTo(b); setTwo(gradient);
    const id = customPalette(a, gradient ? b : undefined);
    applyPalette(id);
    clearTimeout(save.current);
    save.current = setTimeout(() => onChange(id), 350);
  }

  return (
    <div className="flex flex-col gap-4">
      {PALETTE_GROUPS.map(([kind, title]) => (
        <section key={kind}>
          <h3 className="mb-2 text-sm font-semibold">{title}</h3>
          <div role="radiogroup" aria-label={`${title} өнгө`} className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-2">
            {PALETTES.filter(p => p.kind === kind).map(p => {
              const on = value === p.id;
              return (
                <button key={p.id} type="button" role="radio" aria-checked={on} title={p.desc} onClick={() => onChange(p.id)}
                  className={cn('flex min-w-0 flex-col items-center gap-1 rounded-2xl border bg-card p-2 text-xs transition', on ? 'border-2 border-foreground' : 'hover:border-foreground/40')}>
                  <span className="grid h-11 w-full place-items-center rounded-xl text-sm font-bold text-white" style={{ background: swatch(p.from, p.to, kind) }}>{on ? '✓' : ''}</span>
                  <span className="w-full truncate text-center">{p.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <section>
        <h3 className="mb-2 text-sm font-semibold">Өөрийн өнгө</h3>
        <div className={cn('rounded-2xl border bg-card p-3', isCustom && 'border-2 border-foreground')}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="h-11 min-w-16 flex-1 rounded-xl" style={{ background: two ? swatch(from, to) : from }} aria-hidden="true" />
            <label className="flex flex-col items-center gap-1 text-xs">
              <input type="color" value={from} onChange={e => pick(e.target.value, to, two)} aria-label="Үндсэн өнгө" className="size-11 cursor-pointer rounded-lg border bg-transparent p-0.5" />
              Үндсэн
            </label>
            {two && (
              <label className="flex flex-col items-center gap-1 text-xs">
                <input type="color" value={to} onChange={e => pick(from, e.target.value, two)} aria-label="Хоёр дахь өнгө" className="size-11 cursor-pointer rounded-lg border bg-transparent p-0.5" />
                Хоёр дахь
              </label>
            )}
          </div>
          <label className="mt-3 flex items-center justify-between gap-3 text-sm">
            Градиент болгох
            <Switch checked={two} onCheckedChange={v => pick(from, to, v)} aria-label="Градиент болгох" />
          </label>
        </div>
      </section>
    </div>
  );
}
