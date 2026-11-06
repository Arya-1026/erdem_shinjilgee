'use client';

import { askConfirm } from '@/components/confirm-host';
import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { DailyChart, type DayPoint } from '@/components/charts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { mean, scoreOf, topTag } from '@/lib/analytics';
import { WD, moodById } from '@/lib/data';
import { addDays, today, ymd } from '@/lib/date';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { Entry, MoodId } from '@/lib/types';
import { useT } from '@/components/providers/locale-provider';

export type ExpertBooking = {
  id: string; booking_date: string; slot: string; kind: 'video' | 'chat'; share_report: boolean;
  status: 'booked' | 'done' | 'cancelled'; meeting_url: string | null; client_name: string;
};
type ReportRow = { entry_date: string; mood: MoodId; intensity: number; tags: string[]; sleep: number | string | null };

const STATUS_LABEL = { booked: 'Товлосон', done: 'Болсон', cancelled: 'Цуцалсан' };

export function ExpertHeader() {
  const tr = useT();
  return (
    <div className="mb-4 flex items-center justify-between">
      <h1 className="text-xl font-bold">{tr('🧑‍⚕️ Сэтгэл зүйчийн портал')}</h1>
      <Link href="/home" className="text-sm text-primary">{tr('← Апп руу')}</Link>
    </div>
  );
}

export function ExpertPortal({ name, title, initial }: { name: string; title: string; initial: ExpertBooking[] }) {
  const tr = useT();
  const [bookings, setBookings] = useState(initial);
  const upcoming = bookings.filter(b => b.booking_date >= today() && b.status === 'booked');
  const past = bookings.filter(b => !upcoming.includes(b)).reverse();
  const patch = (id: string, p: Partial<ExpertBooking>) => setBookings(list => list.map(b => (b.id === id ? { ...b, ...p } : b)));

  return (
    <>
      <p className="mb-4 text-muted-foreground"><b className="text-foreground">{name}</b> · {title}</p>
      <h2 className="mb-2 font-semibold">{tr('Удахгүй болох ({0})', upcoming.length)}</h2>
      {upcoming.length ? upcoming.map(b => <BookingCard key={b.id} b={b} onChange={p => patch(b.id, p)} />) : <p className="mb-4 text-sm text-muted-foreground">{tr('Одоогоор захиалга алга.')}</p>}
      {past.length > 0 && <>
        <h2 className="mt-6 mb-2 font-semibold">{tr('Өмнөх')}</h2>
        {past.map(b => <BookingCard key={b.id} b={b} onChange={p => patch(b.id, p)} />)}
      </>}
    </>
  );
}

function BookingCard({ b, onChange }: { b: ExpertBooking; onChange: (p: Partial<ExpertBooking>) => void }) {
  const tr = useT();
  const [url, setUrl] = useState(b.meeting_url ?? '');
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ReportRow[] | null>(null);
  const [open, setOpen] = useState(false);

  async function save(status: ExpertBooking['status'], meeting = url.trim()) {
    if (meeting && !/^https:\/\//.test(meeting)) return toast.error(tr('Холбоос https:// -ээр эхлэх ёстой'));
    setBusy(true);
    const { error } = await createClient().rpc('expert_update_booking', { p_booking: b.id, p_status: status, p_meeting_url: meeting || null });
    setBusy(false);
    if (error) return toast.error(error.message);
    onChange({ status, meeting_url: meeting || null });
    toast.success(tr('Хадгалагдлаа'));
  }

  async function toggleReport() {
    setOpen(o => !o);
    if (report) return;
    const { data, error } = await createClient().rpc('expert_report', { p_booking: b.id });
    if (error) return toast.error(error.message);
    setReport((data as ReportRow[]) ?? []);
  }

  return (
    <article className={cn('card-x mb-3', b.status === 'cancelled' && 'opacity-60')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <b>{b.client_name || tr('Үйлчлүүлэгч')}</b>
          <div className="text-sm text-muted-foreground">{b.booking_date} ({tr(WD[new Date(b.booking_date + 'T12:00').getDay()])}) · {b.slot} · {b.kind === 'video' ? tr('🎥 Видео') : tr('💬 Чат')}</div>
        </div>
        <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">{tr(STATUS_LABEL[b.status])}</span>
      </div>

      {b.status === 'booked' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Input value={url} onChange={e => setUrl(e.target.value)} placeholder={tr('Уулзалтын холбоос (Google Meet, Zoom…)')} className="h-10 min-w-0 flex-1 rounded-xl" inputMode="url" />
          <Button size="xl" className="h-10" disabled={busy} onClick={() => save('booked')}>{tr('Холбоос хадгалах')}</Button>
          <Button size="xl" variant="secondary" className="h-10" disabled={busy} onClick={() => save('done')}>{tr('✓ Болсон')}</Button>
          <Button size="xl" variant="destructive" className="h-10" disabled={busy} onClick={() => void askConfirm(tr('Захиалгыг цуцлах уу? Үйлчлүүлэгчид харагдана.'), tr('Цуцлах')).then(ok => { if (ok) void save('cancelled', ''); })}>{tr('Цуцлах')}</Button>
        </div>
      )}

      {b.share_report
        ? <button className="mt-3 text-sm font-semibold text-primary" onClick={toggleReport}>{open ? tr('▲ Тайланг хаах') : tr('📊 30 хоногийн mood тайлан харах')}</button>
        : <p className="mt-3 text-xs text-muted-foreground">{tr('Үйлчлүүлэгч mood тайлангаа хуваалцаагүй.')}</p>}
      {open && (report ? <Report rows={report} until={b.booking_date} /> : <p className="mt-2 text-sm text-muted-foreground">{tr('Ачаалж байна…')}</p>)}
    </article>
  );
}

function Report({ rows, until }: { rows: ReportRow[]; until: string }) {
  const tr = useT();
  if (!rows.length) return <p className="mt-2 text-sm text-muted-foreground">{tr('Энэ хугацаанд бүртгэл алга.')}</p>;
  const entries = rows.map((r, i) => ({ id: String(i), entry_date: r.entry_date, entry_time: '', mood: r.mood, intensity: r.intensity, tags: r.tags, note: '', sleep: r.sleep == null ? null : Number(r.sleep) })) as Entry[];
  // Уулзалтын өдөр хүртэлх 30 хоног (уулзалт ирээдүйд бол сүүлийн бүртгэл хүртэл)
  const last = rows[rows.length - 1].entry_date;
  const end = new Date((last < until ? last : until) + 'T12:00');
  const series: DayPoint[] = [...Array(30)].map((_, i) => {
    const d = addDays(end, i - 29), ds = ymd(d);
    return { label: i % 5 === 0 || i === 29 ? String(d.getDate()) : '', title: `${d.getMonth() + 1}/${d.getDate()}`, v: mean(entries.filter(e => e.entry_date === ds).map(scoreOf)) };
  });
  const counts: Record<string, number> = {}; entries.forEach(e => (counts[e.mood] = (counts[e.mood] || 0) + 1));
  const sleep = mean(entries.filter(e => e.sleep != null).map(e => e.sleep!));
  const hard = topTag(entries.filter(e => scoreOf(e) <= 2));
  return (
    <div className="mt-3 rounded-2xl border p-3">
      <div className="mb-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div><span className="text-muted-foreground">{tr('Дундаж')}</span><b className="block text-lg">{mean(entries.map(scoreOf))!.toFixed(1)} / 5</b></div>
        <div><span className="text-muted-foreground">{tr('Бүртгэл')}</span><b className="block text-lg">{entries.length}</b></div>
        <div><span className="text-muted-foreground">{tr('Дундаж нойр')}</span><b className="block text-lg">{sleep != null ? tr('{0} ц', sleep.toFixed(1)) : '–'}</b></div>
        <div><span className="text-muted-foreground">{tr('Хэцүү өдрийн шалтгаан')}</span><b className="block text-lg">{hard ?? '–'}</b></div>
      </div>
      <DailyChart data={series} />
      <div className="mt-2 flex flex-wrap gap-2 text-sm">
        {Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([m, c]) => <span key={m} className="rounded-full bg-secondary px-2.5 py-0.5">{moodById(m).emoji} {tr(moodById(m).label)} · {c}</span>)}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{tr('Хувийн тэмдэглэл хуваалцагдахгүй. Энэ тайлан онош биш, ярилцлагад туслах мэдээлэл юм.')}</p>
    </div>
  );
}
