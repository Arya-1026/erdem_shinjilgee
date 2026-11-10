'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { useT } from '@/components/providers/locale-provider';
import { DassHelpCard } from '@/components/dass-help';
import { buttonVariants } from '@/components/ui/button';
import { DASS_RETAKE_DAYS, helpLevel, type DassScores } from '@/lib/dass';
import { dassReminder, snoozeDass, visibleDassCard } from '@/lib/dass-client';

/* Нүүр хуудас: DASS-21 бөглөөгүй, эсвэл 2 долоо хоног өнгөрсөн бол зөөлөн сануулна. «Дараа нь» → 3 хоног хойшилно. */
export function DassReminder() {
  const tr = useT();
  // entries, dialog өөрчлөгдөхөд дахин render хийгдэж харагдах эсэхийг шинээр шалгана
  const { supabase, entries } = useApp();
  const [loaded, setKind] = useState<'first' | 'retake' | null>(null);
  const kind = visibleDassCard(loaded, entries.length);
  // Сүүлийн 14 хоногийн үр дүн босго давсан бол Нүүрт ч яаралтай холбогдох картыг харуулна
  const [urgent, setUrgent] = useState<DassScores | null>(null);

  useEffect(() => {
    let alive = true;
    void supabase.from('dass_results').select('created_at,answers,depression,anxiety,stress').order('created_at', { ascending: false }).limit(1)
      .then(({ data, error }) => {
        if (!alive || error) return;
        const last = data?.[0] as (DassScores & { created_at: string; answers: number[] }) | undefined;
        setKind(dassReminder(last?.created_at ?? null));
        const recent = last && Date.now() - new Date(last.created_at).getTime() < DASS_RETAKE_DAYS * 864e5;
        setUrgent(recent && helpLevel(last, last.answers) === 'urgent' ? last : null);
      });
    return () => { alive = false; };
  }, [supabase]);

  if (urgent) return <DassHelpCard level="urgent" scores={urgent} className="mt-4" showResult />;
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
