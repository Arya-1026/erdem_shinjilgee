import { NextResponse } from 'next/server';
import { clientIp, hashRecoveryCode, newRecoveryCode, rateLimited } from '@/lib/server/recovery';
import { createServiceClient } from '@/lib/supabase/server';

// POST /api/auth/register { name, email, password } → бүртгэлийг шууд өгөгдлийн санд үүсгэнэ, имэйл илгээхгүй.
// email_confirm: Supabase баталгаажуулах имэйл явуулахгүй (цагт 2 имэйлийн хязгаарт хамаарахгүй).
export async function POST(req: Request) {
  if (rateLimited('register:' + clientIp(req), 10, 3600e3)) return NextResponse.json({ error: 'too-many' }, { status: 429 });

  const body = await req.json().catch(() => null) as { name?: unknown; email?: unknown; password?: unknown } | null;
  const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 60) : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 6 || password.length > 72) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const recoveryCode = newRecoveryCode();
  const db = createServiceClient();
  const fields = { password, email_confirm: true, user_metadata: { name }, app_metadata: { recovery: hashRecoveryCode(recoveryCode) } };
  const { error } = await db.auth.admin.createUser({ email, ...fields });
  if (error) {
    if (error.code === 'email_exists') {
      // Өмнө нь имэйл баталгаажуулаагүй үлдсэн бүртгэл нэвтэрч чаддаггүй тул дахин бүртгүүлэхэд идэвхжүүлнэ.
      // Баталгаажсан бүртгэлд хүрэхгүй.
      const { data: profile } = await db.from('profiles').select('id').ilike('email', email).maybeSingle();
      const { data } = profile ? await db.auth.admin.getUserById(profile.id) : { data: null };
      if (data?.user && !data.user.email_confirmed_at) {
        const { error: revive } = await db.auth.admin.updateUserById(data.user.id, fields);
        if (!revive) return NextResponse.json({ recoveryCode });
      }
      return NextResponse.json({ error: 'exists' }, { status: 409 });
    }
    console.error('[auth] register', error);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
  return NextResponse.json({ recoveryCode });
}
