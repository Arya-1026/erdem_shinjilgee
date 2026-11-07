'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { useT } from '@/components/providers/locale-provider';
import { buttonVariants } from '@/components/ui/button';
import { DASS_CHOICES, DASS_ITEMS, DASS_MAX, DASS_RETAKE_DAYS, DASS_SCALES, dassDaysLeft, dassLevel, LEVEL_LABEL, SCALE_LABEL, type DassLevel, type DassScores } from '@/lib/dass';
import { cn } from '@/lib/utils';

export const LEVEL_COLOR: Record<DassLevel, string> = {
  normal: 'bg-emerald-500', mild: 'bg-lime-500', moderate: 'bg-amber-500', severe: 'bg-orange-600', extreme: 'bg-red-600',
};

type Row = DassScores & { id: string; answers: number[]; created_at: string };

const fmt = (iso: string) => iso.slice(0, 10).replaceAll('-', '/');

/* Профайл: DASS-21-ийн өмнөх үр дүн, хариултууд. Дарж нээхэд л ачаална. */
export function DassHistory() {
  const tr = useT();
  const { supabase } = useApp();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);

  async function load() {
    const { data, error: e } = await supabase.from('dass_results').select('id,answers,depression,anxiety,stress,created_at').order('created_at', { ascending: false }).limit(50);
    setError(Boolean(e));
    setRows((data ?? []) as Row[]);
  }

  const left = rows ? dassDaysLeft(rows[0]?.created_at) : 0;
  const nextAt = rows?.[0] ? fmt(new Date(new Date(rows[0].created_at).getTime() + DASS_RETAKE_DAYS * 864e5).toISOString()) : '';

  return (
    <details className="group mb-3.5 rounded-2xl border bg-card" onToggle={e => { if ((e.target as HTMLDetailsElement).open && rows === null) void load(); }}>
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl p-3.5 hover:bg-secondary [&::-webkit-details-marker]:hidden">
        <span className="text-2xl" aria-hidden="true">🧠</span>
        <span className="min-w-0 flex-1">
          <b className="block">{tr('Сэтгэл зүйн асуулга (DASS-21)')}</b>
          <span className="block text-xs text-muted-foreground">{tr('Өмнөх үр дүн, хариултаа харах')}</span>
        </span>
        <span className="transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
      </summary>

      <div className="border-t p-3.5">
        {rows === null ? <p className="text-sm text-muted-foreground">{tr('Ачаалж байна…')}</p>
          : error ? <p className="text-sm text-destructive">{tr('Үр дүнг ачаалж чадсангүй')}</p>
          : !rows.length ? <p className="text-sm text-muted-foreground">{tr('Та асуулгыг хараахан бөглөөгүй байна.')}</p>
          : (
            <div className="grid gap-2">
              {rows.map((r, n) => (
                <details key={r.id} className="group/r rounded-xl bg-secondary/60" open={n === 0}>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                    <b className="tabular-nums">{fmt(r.created_at)}</b>
                    {n === 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">{tr('Сүүлийнх')}</span>}
                    <span className="flex flex-wrap gap-1.5 text-xs">
                      {DASS_SCALES.map(k => {
                        const lv = dassLevel(k, r[k]);
                        return <span key={k} className="inline-flex items-center gap-1"><i className={cn('inline-block size-2 rounded-full', LEVEL_COLOR[lv])} />{tr(SCALE_LABEL[k])}: {tr(LEVEL_LABEL[lv])}</span>;
                      })}
                    </span>
                    <span className="ml-auto transition-transform group-open/r:rotate-180" aria-hidden="true">⌄</span>
                  </summary>
                  <div className="px-3 pb-3">
                    <div className="grid gap-2">
                      {DASS_SCALES.map(k => {
                        const lv = dassLevel(k, r[k]);
                        return (
                          <div key={k}>
                            <div className="flex justify-between text-sm"><span>{tr(SCALE_LABEL[k])}</span><span className="tabular-nums">{tr(LEVEL_LABEL[lv])} · {r[k]}/{DASS_MAX}</span></div>
                            <div className="mt-1 h-2 overflow-hidden rounded-full bg-background"><div className={cn('h-full rounded-full', LEVEL_COLOR[lv])} style={{ width: `${Math.max(4, (r[k] / DASS_MAX) * 100)}%` }} /></div>
                          </div>
                        );
                      })}
                    </div>
                    <details className="mt-3 text-sm">
                      <summary className="cursor-pointer font-semibold text-primary">{tr('Миний хариултууд')}</summary>
                      <ol className="mt-2 grid gap-1.5">
                        {DASS_ITEMS.map((q, i) => (
                          <li key={i} className="rounded-lg bg-background px-2.5 py-1.5">
                            <span className="text-muted-foreground">{i + 1}. {tr(q.mn)}</span>
                            <b className="mt-0.5 block">{r.answers[i]} · {tr(DASS_CHOICES[r.answers[i]] ?? '')}</b>
                          </li>
                        ))}
                      </ol>
                    </details>
                  </div>
                </details>
              ))}
            </div>
          )}
        {rows !== null && !error && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              {left > 0 ? tr('Дахин бөглөх: {0} хоногийн дараа ({1})', left, nextAt) : tr('14 хоногт нэг удаа бөглөнө.')}
            </span>
            <Link href="/dass" className={buttonVariants({ size: 'sm', variant: left > 0 ? 'secondary' : 'default' })}>
              {left > 0 ? tr('Сүүлийн үр дүн') : rows.length ? tr('↻ Дахин бөглөх') : tr('Бөглөх')}
            </Link>
          </div>
        )}
      </div>
    </details>
  );
}
