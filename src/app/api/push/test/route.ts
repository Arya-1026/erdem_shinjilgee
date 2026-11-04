import { NextResponse } from 'next/server';
import { pushConfigured, sendPush } from '@/lib/server/push';
import { createClient } from '@/lib/supabase/server';

// Профайл → "Туршиж үзэх": өөрийн бүх төхөөрөмж рүү туршилтын мэдэгдэл
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ error: 'not-configured' }, { status: 503 });
  const r = await sendPush([user.id], { title: 'Сэтгэл 🌙', body: 'Мэдэгдэл амжилттай ажиллаж байна!', url: '/profile', tag: 'test' });
  return NextResponse.json(r);
}
