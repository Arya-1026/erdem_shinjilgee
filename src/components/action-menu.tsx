'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useT } from '@/components/providers/locale-provider';

export type MenuItem = { label: string; onSelect: () => void; danger?: boolean } | false | null | undefined;

const GAP = 4, PAD = 8;

/* «⋯» товч: дарахад үйлдлийн жагсаалт гарна. Гадна дарах, Esc, гүйлгэхэд хаагдана.
   Цэс position:fixed тул гүйлгэдэг жагсаалт (overflow) дотор хавчигдахгүй. Доор зай хүрэхгүй бол дээшээ нээгдэнэ. */
export function ActionMenu({ items, label, className, align = 'right' }: { items: MenuItem[]; label?: string; className?: string; align?: 'left' | 'right' }) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { if (!(e.target instanceof Node && box.current?.contains(e.target))) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const scroll = (e: Event) => { if (!(e.target instanceof Node && menu.current?.contains(e.target))) setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    window.addEventListener('scroll', scroll, true);
    window.addEventListener('resize', scroll);
    return () => {
      document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc);
      window.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', scroll);
    };
  }, [open]);

  // Товчны байрлалаас цэсний байрлалыг тооцно. Dialog (transform-той) дотор fixed нь тэр dialog-оос хэмжигддэг тул зөрүүг засна.
  useLayoutEffect(() => {
    const b = btn.current?.getBoundingClientRect(), m = menu.current;
    if (!open) return;
    if (!b || !m) return;
    const w = m.offsetWidth, h = m.offsetHeight;
    let top = b.bottom + GAP;
    if (top + h > window.innerHeight - PAD && b.top - GAP - h > PAD) top = b.top - GAP - h;
    let left = align === 'right' ? b.right - w : b.left;
    left = Math.min(Math.max(PAD, left), window.innerWidth - w - PAD);
    m.style.top = '0px'; m.style.left = '0px';
    const origin = m.getBoundingClientRect();
    m.style.top = `${top - origin.top}px`; m.style.left = `${left - origin.left}px`; m.style.visibility = 'visible';
  }, [open, align]);

  const list = items.filter(Boolean) as Exclude<MenuItem, false | null | undefined>[];
  return (
    <div ref={box} className={cn('relative flex-none', className)}>
      <button ref={btn} type="button" aria-label={label ?? tr('Үйлдэл')} aria-haspopup="menu" aria-expanded={open}
        className="grid size-9 place-items-center rounded-full text-lg text-muted-foreground hover:bg-secondary"
        onClick={e => { e.preventDefault(); e.stopPropagation(); setOpen(o => !o); }}>⋯</button>
      {open && (
        <div ref={menu} role="menu" style={{ visibility: 'hidden' }}
          className="fixed z-[60] min-w-48 overflow-hidden rounded-xl border bg-popover py-1 text-sm shadow-lg">
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
