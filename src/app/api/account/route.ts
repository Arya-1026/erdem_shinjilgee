import { createClient as createPlainClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// Бүртгэл устгах хүсэлт. 30 хоног нэвтрэхгүй бол бүрмөсөн устгагдана.
// Нууц үгээр (Google-ээр бүртгүүлсэн бол имэйлээр) баталгаажуулна.
export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { password?: unknown; email?: unknown } | null;
  const hasPassword = user.identities?.some(i => i.provider === 'email');
  if (hasPassword) {
    if (typeof body?.password !== 'string' || !body.password) return NextResponse.json({ error: 'wrong-password' }, { status: 403 });
    // Cookie-д холбоогүй түр client: одоогийн session-д нөлөөлөхгүй
    const check = createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await check.auth.signInWithPassword({ email: user.email!, password: body.password });
    if (error) return NextResponse.json({ error: 'wrong-password' }, { status: 403 });
  } else if (typeof body?.email !== 'string' || body.email.trim().toLowerCase() !== user.email?.toLowerCase()) {
    return NextResponse.json({ error: 'wrong-email' }, { status: 403 });
  }

  // Шууд устгахгүй: 30 хоногийн дотор дахин нэвтэрвэл сэргээгдэнэ (dal.ts → requireUser),
  // нэвтрэхгүй бол /api/cron/purge-accounts бүрмөсөн устгана.
  const { error } = await createServiceClient().from('profiles').update({ deletion_requested_at: new Date().toISOString() }).eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Бүх төхөөрөмжөөс гаргана: өөр төхөөрөмж дээр нээлттэй байсан session санамсаргүй сэргээхгүй
  await supabase.auth.signOut({ scope: 'global' });
  return NextResponse.json({ ok: true, purgeAfterDays: 30 });
}
