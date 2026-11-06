import { NextResponse } from 'next/server';
import { clientIp, rateLimited } from '@/lib/server/recovery';
import { createServiceClient } from '@/lib/supabase/server';

// POST /api/auth/recover { email, password } → нууц үгийг шууд солино.
// АНХААР: түр шийдэл. Имэйл эзэмшдэг эсэхийг шалгадаггүй тул имэйлийг мэдсэн хэн ч нууц үг сольж чадна.
// Жинхэнэ хэрэглэгчидтэй болохоос өмнө баталгаажуулалт (имэйлийн SMTP гэх мэт) нэмэх шаардлагатай.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { email?: unknown; password?: unknown } | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!email || password.length < 6 || password.length > 72) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  if (rateLimited('recover:' + clientIp(req), 10, 900e3) || rateLimited('recover:' + email, 5, 900e3)) return NextResponse.json({ error: 'too-many' }, { status: 429 });

  const db = createServiceClient();
  const { data: profile } = await db.from('profiles').select('id').ilike('email', email).maybeSingle();
  if (!profile) return NextResponse.json({ error: 'not-found' }, { status: 404 });

  const { error } = await db.auth.admin.updateUserById(profile.id, { password, email_confirm: true });
  if (error) {
    console.error('[auth] recover', error);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
