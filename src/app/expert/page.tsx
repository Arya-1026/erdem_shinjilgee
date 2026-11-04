import Link from 'next/link';
import { Suspense } from 'react';
import { requireUser } from '@/lib/server/dal';
import { ExpertPortal, type ExpertBooking } from './expert-portal';

export default function ExpertPage() {
  return (
    <div className="mx-auto max-w-[900px] px-4 pt-[calc(16px+env(safe-area-inset-top))] pb-10">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">🧑‍⚕️ Сэтгэл зүйчийн портал</h1>
        <Link href="/home" className="text-sm text-primary">← Апп руу</Link>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">Ачаалж байна…</p>}>
        <ExpertData />
      </Suspense>
    </div>
  );
}

async function ExpertData() {
  const { supabase } = await requireUser();
  const { data: expertId } = await supabase.rpc('my_expert_id');
  if (!expertId) return (
    <div className="card-x">
      <p>Таны бүртгэл сэтгэл зүйчтэй холбогдоогүй байна.</p>
      <p className="mt-2 text-sm text-muted-foreground">Админ Supabase SQL Editor дээр <code>update experts set user_id = &apos;&lt;таны user id&gt;&apos; where id = &apos;p1&apos;;</code> гэж холбоно.</p>
    </div>
  );
  const [{ data: expert }, { data: bookings }] = await Promise.all([
    supabase.from('experts').select('name,title').eq('id', expertId).single(),
    supabase.rpc('expert_bookings'),
  ]);
  return <ExpertPortal name={expert?.name ?? ''} title={expert?.title ?? ''} initial={(bookings as ExpertBooking[]) ?? []} />;
}
