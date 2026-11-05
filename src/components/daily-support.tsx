'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { todaysEntries } from '@/lib/analytics';
import { moodById } from '@/lib/data';
import { today } from '@/lib/date';
import { cn } from '@/lib/utils';
import { useApp } from './providers/app-provider';
import { buttonVariants } from './ui/button';
import { useT } from '@/components/providers/locale-provider';

type State =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'crisis' }
  | { kind: 'ok'; message: string; steps: string[]; mood: string; ai: boolean }
  | { kind: 'error' };

// Нүүр хуудас, «Бүртгэгдлээ» цонх хоёр зэрэг асуухад LLM-ийг нэг л удаа дуудна
const inflight = new Map<string, Promise<Record<string, unknown>>>();
function load(date: string, entryId: string) {
  const key = `${date}|${entryId}`;
  let p = inflight.get(key);
  if (!p) {
    p = fetch(`/api/support?date=${date}`, { cache: 'no-store' }).then(r => r.json());
    p.catch(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}

const toState = (j: Record<string, unknown>): State =>
  j.crisis ? { kind: 'crisis' } : j.none ? { kind: 'none' }
    : typeof j.message === 'string' ? { kind: 'ok', message: j.message, steps: (j.steps as string[]) ?? [], mood: String(j.mood), ai: j.source !== 'fallback' }
      : { kind: 'error' };

/** Өнөөдрийн бүртгэлд тулгуурласан AI-ийн дэмжлэг. Шинэ бүртгэл нэмэгдэхэд өөрөө шинэчлэгдэнэ. */
export function useDailySupport() {
  const tr = useT();
  const { entries } = useApp();
  const latest = todaysEntries(entries)[0]?.id ?? null;
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [busy, setBusy] = useState(false);


  useEffect(() => {
    if (!latest) return;
    let alive = true;
    load(today(), latest).then(j => { if (alive) setState(toState(j)); })
      .catch(() => { if (alive) setState({ kind: 'error' }); });
    return () => { alive = false; };
  }, [latest]);

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const r = await fetch('/api/support', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: today(), refresh: true }) });
      const j = await r.json();
      inflight.clear(); // шинэ үгийг бусад газар ч харуулна
      setState(toState(j));
    } catch {
      toast.error(tr('Шинэчилж чадсангүй'));
    } finally {
      setBusy(false);
    }
  }, [tr]);

  return { state: latest ? state : ({ kind: 'none' } as State), refresh, busy };
}

/** Нүүр хуудасны «Өнөөдрийн дэмжлэг» карт, мөн «Бүртгэгдлээ» цонхонд */
export function SupportBody({ compact }: { compact?: boolean }) {
  const tr = useT();
  const { setChatOpen } = useApp();
  const { state, refresh, busy } = useDailySupport();

  if (state.kind === 'none') return <p className="text-sm text-muted-foreground">{tr('Өнөөдрийн сэтгэл санаагаа бүртгэвэл танд зориулсан дэмжлэгийн үг, хийж болох жижиг алхмуудыг AI бэлдэж өгнө.')}</p>;
  if (state.kind === 'loading') return (
    <div className="space-y-2" aria-label={tr('Бэлдэж байна')}>
      <p className="text-sm text-muted-foreground">{tr('💭 Таны өнөөдрийн бүртгэлийг уншиж, дэмжлэг бэлдэж байна…')}</p>
      <div className="h-3 w-11/12 animate-pulse rounded bg-muted" /><div className="h-3 w-4/5 animate-pulse rounded bg-muted" /><div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
    </div>
  );
  if (state.kind === 'error') return <p className="text-sm text-muted-foreground">{tr('Одоогоор дэмжлэг гаргаж чадсангүй.')}{' '}<button className="font-semibold text-primary" onClick={refresh}>{tr('Дахин оролдох')}</button></p>;
  if (state.kind === 'crisis') return (
    <div role="alert" className="rounded-2xl bg-destructive/10 p-3.5">
      <b>{tr('Та ганцаараа биш 💜')}</b>
      <p className="my-1.5 text-sm">{tr('Таны бичсэн зүйл надад санаа зовоож байна. Яг одоо мэргэжлийн хүнтэй ярилцахыг хүсч байна.')}</p>
      <div className="flex flex-wrap gap-2">
        <a className={buttonVariants({ variant: 'destructive', size: 'xl' })} href="tel:103">📞 103</a>
        <a className={buttonVariants({ variant: 'destructive', size: 'xl' })} href="tel:108">{tr('📞 108 Тусламжийн утас')}</a>
        <Link className={buttonVariants({ size: 'xl' })} href="/experts">{tr('Сэтгэл зүйч')}</Link>
      </div>
    </div>
  );

  return (
    <div>
      <p className={cn('whitespace-pre-line', compact ? 'text-[15px]' : 'text-base')}>{state.message}</p>
      {state.steps.length > 0 && (
        <ol className="mt-3 space-y-1.5">
          {state.steps.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-sm">
              <span className="grid size-6 flex-none place-items-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground">{i + 1}</span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <button className="font-semibold text-primary disabled:opacity-50" disabled={busy} onClick={refresh}>{busy ? tr('Бичиж байна…') : tr('↻ Өөр үгээр')}</button>
        {!compact && <button className="font-semibold text-primary" onClick={() => setChatOpen(true)}>{tr('💬 Энэ талаар ярилцах')}</button>}
        <span className="ml-auto text-xs text-muted-foreground">{state.ai ? '✨ AI · ' : ''}{moodById(state.mood).emoji} {tr(moodById(state.mood).label)}</span>
      </div>
    </div>
  );
}

export function DailySupportCard() {
  const tr = useT();
  return (
    <section className="card-x grad-meadow border-border" aria-live="polite">
      <h3 className="mb-2 font-semibold">{tr('💚 Өнөөдрийн дэмжлэг')}</h3>
      <SupportBody />
    </section>
  );
}
