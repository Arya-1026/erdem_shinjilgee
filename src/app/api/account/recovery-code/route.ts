import { createClient as createPlainClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { hashRecoveryCode, newRecoveryCode } from '@/lib/server/recovery';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// POST /api/account/recovery-code { password } → одоогийн нууц үгээр баталгаажуулж шинэ сэргээх код үүсгэнэ
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { password?: unknown } | null;
  const password = typeof body?.password === 'string' ? body.password : '';
  // Cookie-д холбоогүй түр client: одоогийн session-д нөлөөлөхгүй
  const check = createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: wrong } = await check.auth.signInWithPassword({ email: user.email!, password });
  if (wrong) return NextResponse.json({ error: 'wrong-password' }, { status: 403 });

  const recoveryCode = newRecoveryCode();
  const { error } = await createServiceClient().auth.admin.updateUserById(user.id, { app_metadata: { ...user.app_metadata, recovery: hashRecoveryCode(recoveryCode) } });
  if (error) return NextResponse.json({ error: 'failed' }, { status: 500 });
  return NextResponse.json({ recoveryCode });
}
