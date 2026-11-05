import { NextResponse } from 'next/server';
import { clientIp, hashRecoveryCode, newRecoveryCode, rateLimited, recoveryCodeMatches } from '@/lib/server/recovery';
import { createServiceClient } from '@/lib/supabase/server';

// POST /api/auth/recover { email, code, password } → сэргээх кодоор нууц үг солино. Код нэг удаагийнх: шинийг буцаана.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null) as { email?: unknown; code?: unknown; password?: unknown } | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const code = typeof body?.code === 'string' ? body.code : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!email || !code || password.length < 6 || password.length > 72) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  if (rateLimited('recover:' + clientIp(req), 10, 900e3) || rateLimited('recover:' + email, 5, 900e3)) return NextResponse.json({ error: 'too-many' }, { status: 429 });

  const db = createServiceClient();
  const { data: profile } = await db.from('profiles').select('id').ilike('email', email).maybeSingle();
  const { data } = profile ? await db.auth.admin.getUserById(profile.id) : { data: null };
  // Бүртгэл байгаа эсэхийг ялгаж харуулахгүй
  if (!data?.user || !recoveryCodeMatches(code, data.user.app_metadata?.recovery)) return NextResponse.json({ error: 'wrong-code' }, { status: 403 });

  const recoveryCode = newRecoveryCode();
  const { error } = await db.auth.admin.updateUserById(data.user.id, { password, app_metadata: { ...data.user.app_metadata, recovery: hashRecoveryCode(recoveryCode) } });
  if (error) {
    console.error('[auth] recover', error);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
  return NextResponse.json({ recoveryCode });
}
