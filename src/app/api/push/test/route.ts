import { NextResponse } from 'next/server';
import { requestT } from '@/lib/server/locale';
import { pushConfigured, sendPush } from '@/lib/server/push';
import { createClient } from '@/lib/supabase/server';

// Профайл → "Туршиж үзэх": өөрийн бүх төхөөрөмж рүү туршилтын мэдэгдэл
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ error: 'not-configured' }, { status: 503 });
  const tr = await requestT();
  const r = await sendPush([user.id], { title: tr('Сэтгэл 🌙'), body: tr('Мэдэгдэл амжилттай ажиллаж байна!'), url: '/profile', tag: 'test' });
  return NextResponse.json(r);
}
