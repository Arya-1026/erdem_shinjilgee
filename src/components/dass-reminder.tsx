'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { useT } from '@/components/providers/locale-provider';
import { buttonVariants } from '@/components/ui/button';
import { dassReminder, snoozeDass } from '@/lib/dass-client';

/* Нүүр хуудас: DASS-21 бөглөөгүй, эсвэл 2 долоо хоног өнгөрсөн бол зөөлөн сануулна. «Дараа нь» → 3 хоног хойшилно. */
export function DassReminder() {
  const tr = useT();
  const { supabase } = useApp();
  const [kind, setKind] = useState<'first' | 'retake' | null>(null);

  useEffect(() => {
    let alive = true;
    void supabase.from('dass_results').select('created_at').order('created_at', { ascending: false }).limit(1)
      .then(({ data, error }) => { if (alive && !error) setKind(dassReminder(data?.[0]?.created_at ?? null)); });
    return () => { alive = false; };
  }, [supabase]);

  if (!kind) return null;
  return (
    <section className="card-x mt-4 flex items-start gap-3">
      <span className="text-4xl" aria-hidden="true">🐫</span>
      <div className="min-w-0 flex-1">
        <b>{kind === 'first' ? tr('Сэтгэл зүйн богино асуулга бөглөх үү?') : tr('2 долоо хоног өнгөрлөө: дахин бөглөх үү?')}</b>
        <p className="mt-0.5 text-sm text-muted-foreground">{tr('21 асуулт, 3 минут. Гутрал, түгшүүр, стрессээ хараад танд тохирох дасгал аваарай.')}</p>
        <div className="mt-2.5 flex gap-2">
          <Link href="/dass" className={buttonVariants({ size: 'sm' })}>{tr('Бөглөх')}</Link>
          <button type="button" className={buttonVariants({ size: 'sm', variant: 'ghost' })} onClick={() => { snoozeDass(); setKind(null); }}>{tr('Дараа нь')}</button>
        </div>
      </div>
    </section>
  );
}
