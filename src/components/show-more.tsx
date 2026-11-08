'use client';

import { useState } from 'react';
import { useT } from '@/components/providers/locale-provider';

/** Эхний хэдэн зүйлийг харуулж, үлдсэнийг товч дарж нээнэ (профайлын хобби, дуучид) */
export function ShowMore<T>({ items, limit = 8, render, className }: { items: T[]; limit?: number; render: (item: T) => React.ReactNode; className?: string }) {
  const tr = useT();
  const [open, setOpen] = useState(false);
  const rest = items.length - limit;
  return (
    <div className={className}>
      {(open || rest <= 0 ? items : items.slice(0, limit)).map(render)}
      {rest > 0 && (
        <button type="button" aria-expanded={open} onClick={() => setOpen(o => !o)}
          className="inline-flex min-h-[38px] items-center rounded-full border-[1.5px] border-dashed border-primary px-3.5 text-sm font-semibold text-primary">
          {open ? tr('Хураах ▲') : tr('+{0} бусдыг харах', rest)}
        </button>
      )}
    </div>
  );
}
