import { NextResponse } from 'next/server';
import { BOOKING_COLS } from '@/lib/db';
import { weekdayOf } from '@/lib/date';
import { sendBookingConfirmation, sendExpertNotice } from '@/lib/server/email';
import { requestLocale } from '@/lib/server/locale';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const b = await req.json().catch(() => null);
  const date: string = b?.date ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !['video', 'chat'].includes(b?.kind) || typeof b?.slot !== 'string' || typeof b?.expertId !== 'string')
    return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const tomorrow = new Date(Date.now() + 864e5).toISOString().slice(0, 10);
  if (date < tomorrow) return NextResponse.json({ error: 'past' }, { status: 400 });

  // Сэтгэл зүйчийн хуваарьт тухайн гарагийн цаг байгаа эсэх
  const [{ data: expert }, { data: slot }] = await Promise.all([
    supabase.from('experts').select('id,name').eq('id', b.expertId).maybeSingle(),
    supabase.from('expert_slots').select('slot').eq('expert_id', b.expertId).eq('weekday', weekdayOf(date)).eq('slot', b.slot).maybeSingle(),
  ]);
  if (!expert || !slot) return NextResponse.json({ error: 'unavailable' }, { status: 400 });

  const { data, error } = await supabase
    .from('bookings')
    .insert({ expert_id: expert.id, booking_date: date, slot: b.slot, kind: b.kind, share_report: Boolean(b.share) })
    .select(BOOKING_COLS)
    .single();
  // bookings_unique_slot: хоёр хүн нэг цагийг зэрэг захиалахаас сэргийлнэ
  if (error?.code === '23505') return NextResponse.json({ error: 'taken' }, { status: 409 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const info = { expert: expert.name, date, slot: b.slot, kind: b.kind };
  const { data: profile } = await supabase.from('profiles').select('name,email').eq('id', user.id).single();
  if (profile?.email) await sendBookingConfirmation(profile.email, profile.name, info, await requestLocale());

  // Сэтгэл зүйч портал-тай бол түүнд ч мэдэгдэнэ
  if (process.env.SUPABASE_SECRET_KEY) {
    const admin = createServiceClient();
    const { data: x } = await admin.from('experts').select('user_id').eq('id', expert.id).single();
    const { data: xp } = x?.user_id ? await admin.from('profiles').select('email').eq('id', x.user_id).single() : { data: null };
    if (xp?.email) await sendExpertNotice(xp.email, { ...info, client: profile?.name ?? '', share: Boolean(b.share) });
  }

  return NextResponse.json(data);
}
