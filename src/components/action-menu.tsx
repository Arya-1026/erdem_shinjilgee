'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useT } from '@/components/providers/locale-provider';

export type MenuItem = { label: string; onSelect: () => void; danger?: boolean } | false | null | undefined;

/* «⋯» товч: дарахад үйлдлийн жагсаалт гарна. Гадна дарах, Esc-ээр хаагдана. */
export function ActionMenu({ items, label, className, align = 'right' }: { items: MenuItem[]; label?: string; className?: string; align?: 'left' | 'right' }) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (!(e.target instanceof Node && box.current?.contains(e.target))) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const list = items.filter(Boolean) as Exclude<MenuItem, false | null | undefined>[];
  return (
    <div ref={box} className={cn('relative flex-none', className)}>
      <button type="button" aria-label={label ?? tr('Үйлдэл')} aria-haspopup="menu" aria-expanded={open}
        className="grid size-9 place-items-center rounded-full text-lg text-muted-foreground hover:bg-secondary"
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}>⋯</button>
      {open && (
        <div role="menu" className={cn('absolute top-full z-40 mt-1 min-w-48 overflow-hidden rounded-xl border bg-popover py-1 text-sm shadow-lg', align === 'right' ? 'right-0' : 'left-0')}>
          {list.map(it => (
            <button key={it.label} type="button" role="menuitem"
              className={cn('block w-full px-3.5 py-2.5 text-left hover:bg-secondary', it.danger && 'text-destructive')}
              onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(false); it.onSelect(); }}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
