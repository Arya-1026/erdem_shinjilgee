import { Suspense } from 'react';
import { requireUser } from '@/lib/server/dal';
import { requestT } from '@/lib/server/locale';
import { ExpertHeader, ExpertPortal, type ExpertBooking } from './expert-portal';

export default function ExpertPage() {
  return (
    <div className="mx-auto max-w-[900px] px-4 pt-[calc(16px+env(safe-area-inset-top))] pb-10">
      <ExpertHeader />
      <Suspense fallback={<p className="text-muted-foreground" aria-hidden="true">…</p>}>
        <ExpertData />
      </Suspense>
    </div>
  );
}

async function ExpertData() {
  const { supabase } = await requireUser();
  const tr = await requestT();
  const { data: expertId } = await supabase.rpc('my_expert_id');
  if (!expertId) return (
    <div className="card-x">
      <p>{tr('Таны бүртгэл сэтгэл зүйчтэй холбогдоогүй байна.')}</p>
      <p className="mt-2 text-sm text-muted-foreground">{tr('Админ Supabase SQL Editor дээр дараах тушаалаар холбоно:')} <code>update experts set user_id = &apos;&lt;user id&gt;&apos; where id = &apos;p1&apos;;</code></p>
    </div>
  );
  const [{ data: expert }, { data: bookings }] = await Promise.all([
    supabase.from('experts').select('name,title').eq('id', expertId).single(),
    supabase.rpc('expert_bookings'),
  ]);
  return <ExpertPortal name={expert?.name ?? ''} title={expert?.title ?? ''} initial={(bookings as ExpertBooking[]) ?? []} />;
}
