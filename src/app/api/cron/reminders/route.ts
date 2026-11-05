import { NextResponse } from 'next/server';
import { isLocale, LOCALES, translator, type Locale } from '@/lib/i18n';
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

  // Хэрэглэгч бүрийн сонгосон хэлээр илгээнэ
  const { data: langs } = users.length ? await admin.from('profiles').select('id,language').in('id', users.map(u => u.user_id)) : { data: [] };
  const langOf = new Map((langs ?? []).map(p => [p.id as string, isLocale(p.language) ? p.language : 'mn' as Locale]));
  const localeOf = (id: string) => langOf.get(id) ?? 'mn';

  const sent: string[] = [];
  for (const u of users) {
    const r = await sendReminder(u.email, u.name, localeOf(u.user_id));
    if (r.ok) sent.push(u.user_id);
  }
  let pushed = 0;
  for (const locale of LOCALES) {
    const ids = users.filter(u => localeOf(u.user_id) === locale).map(u => u.user_id);
    if (!ids.length) continue;
    const tr = translator(locale);
    pushed += (await sendPush(ids, { title: tr('Өнөөдөр ямар байна? 🌙'), body: tr('Сэтгэл санаагаа 10 секундэд тэмдэглээрэй.'), url: '/home', tag: 'reminder' })).sent;
  }
  // Нэг өдөрт нэг л удаа: аль сувгаар очсоноос үл хамааран тэмдэглэнэ (10 минутын цонхонд давтахгүй)
  if (users.length) await admin.rpc('mark_reminded', { ids: users.map(u => u.user_id) });

  return NextResponse.json({ due: users.length, emailed: sent.length, pushed });
}
