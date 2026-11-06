'use client';

import { askConfirm } from '@/components/confirm-host';
import { useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Chip } from '@/components/segmented';
import { Button, buttonVariants } from '@/components/ui/button';
import { today } from '@/lib/date';
import { useT } from '@/components/providers/locale-provider';

const STATUS = { booked: '', done: ' · ✓ Болсон', cancelled: ' · Сэтгэл зүйч цуцалсан' };

export default function ExpertsPage() {
  const tr = useT();
  const { bookings, cancelBooking, openDialog, experts } = useApp();
  const [filter, setFilter] = useState('Бүгд');
  const specs = ['Бүгд', ...new Set(experts.flatMap(e => e.spec))];
  const list = experts.filter(e => filter === 'Бүгд' || e.spec.includes(filter));
  const upcoming = bookings.filter(b => b.booking_date >= today());

  return (
    <>
      {upcoming.length > 0 && (
        <section className="card-x mb-4">
          <h3 className="font-semibold">{tr('📅 Миний захиалгууд')}</h3>
          {upcoming.map(b => {
            const e = experts.find(x => x.id === b.expert_id);
            return (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-2.5 border-b py-2.5 last:border-0">
                <div>
                  <b>{e?.name ?? b.expert_id}</b>
                  <div className="text-sm text-muted-foreground">{b.booking_date} · {b.slot} · {b.kind === 'video' ? tr('🎥 Видео') : tr('💬 Чат')}{b.share_report && tr(' · тайлан хуваалцсан')}{tr(STATUS[b.status])}</div>
                  {b.status === 'booked' && !b.meeting_url && <div className="text-xs text-muted-foreground">{tr('Уулзалтын холбоосыг сэтгэл зүйч оруулахаар энд гарч ирнэ.')}</div>}
                </div>
                <div className="flex gap-2">
                  {b.meeting_url && b.status === 'booked' && (
                    <a href={b.meeting_url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ size: 'xl', className: 'h-10' })}>{tr('Уулзалтад орох')}</a>
                  )}
                  {b.status === 'booked' && <Button variant="destructive" size="xl" className="h-10" onClick={() => void askConfirm(tr('Захиалгаа цуцлах уу?'), tr('Цуцлах')).then(ok => { if (ok) void cancelBooking(b.id); })}>{tr('Цуцлах')}</Button>}
                </div>
              </div>
            );
          })}
        </section>
      )}

      <div className="mb-3.5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {specs.map(s => <Chip key={s} on={filter === s} onClick={() => setFilter(s)}>{tr(s)}</Chip>)}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3">
        {list.map(e => (
          <article key={e.id} className="card-x">
            <div className="flex items-start gap-3">
              <div className="grid size-14 flex-none place-items-center rounded-2xl text-xl font-bold text-white" style={{ background: e.color }}>{e.name.split(' ')[1][0]}</div>
              <div>
                <b>{e.name}</b>
                <div className="text-sm text-muted-foreground">{tr(e.title)}</div>
                <div className="mt-1.5 flex flex-wrap gap-1">{e.spec.map(s => <span key={s} className="rounded-full bg-secondary px-2 py-0.5 text-[.7rem] font-semibold text-secondary-foreground">{tr(s)}</span>)}</div>
              </div>
            </div>
            <div className="my-2 flex flex-wrap gap-3 text-sm text-muted-foreground"><span>⭐ {e.rating}</span><span>{tr('🎓 {0} жил', e.exp)}</span><span>{tr('💳 {0}₮ / 50 мин', e.price.toLocaleString())}</span></div>
            <Button size="xl" className="w-full" onClick={() => openDialog({ kind: 'book', expertId: e.id })}>{tr('Цаг захиалах')}</Button>
          </article>
        ))}
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{tr('✅ Бүх сэтгэл зүйч мэргэжлийн лицензээ баталгаажуулсан. Яаралтай үед')}{' '}<a href="tel:103" className="font-semibold text-primary">103</a>{' '}{tr('руу залгана уу.')}</p>
    </>
  );
}
