import { NextResponse } from 'next/server';
import { sendReminder } from '@/lib/server/email';
import { sendPush } from '@/lib/server/push';
import { createServiceClient } from '@/lib/supabase/server';

// Supabase pg_cron 5 минут тутамд pg_net-ээр дууддаг (supabase/migrations/0002_cron.sql).
// Сануулгыг имэйл болон push (бүртгүүлсэн төхөөрөмж бүр) хоёроор илгээнэ.
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`)
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createServiceClient();
  const { data: due, error } = await admin.rpc('due_reminders');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const users = (due ?? []) as { user_id: string; email: string; name: string }[];

  const sent: string[] = [];
  for (const u of users) {
    const r = await sendReminder(u.email, u.name);
    if (r.ok) sent.push(u.user_id);
  }
  const push = await sendPush(users.map(u => u.user_id), { title: 'Өнөөдөр ямар байна? 🌙', body: 'Сэтгэл санаагаа 10 секундэд тэмдэглээрэй.', url: '/home', tag: 'reminder' });
  // Нэг өдөрт нэг л удаа: аль сувгаар очсоноос үл хамааран тэмдэглэнэ (10 минутын цонхонд давтахгүй)
  if (users.length) await admin.rpc('mark_reminded', { ids: users.map(u => u.user_id) });

  return NextResponse.json({ due: users.length, emailed: sent.length, pushed: push.sent });
}
