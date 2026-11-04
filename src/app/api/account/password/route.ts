import { createClient as createPlainClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

// POST /api/account/password { current, next }: одоогийн нууц үгийг шалгаад шинээр солино.
// Нууц үгээ мартсан бол клиент имэйлээр код авч (recovery OTP) солино.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { current?: unknown; next?: unknown } | null;
  const current = typeof body?.current === 'string' ? body.current : '';
  const next = typeof body?.next === 'string' ? body.next : '';
  if (next.length < 6 || next.length > 72) return NextResponse.json({ error: 'weak-password' }, { status: 400 });
  // Google-ээр бүртгүүлсэн хүнд нууц үг байхгүй: имэйлийн кодоор тохируулна
  if (!user.identities?.some(i => i.provider === 'email')) return NextResponse.json({ error: 'no-password' }, { status: 400 });

  // Cookie-д холбоогүй түр client: одоогийн session-д нөлөөлөхгүй
  const check = createPlainClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: wrong } = await check.auth.signInWithPassword({ email: user.email!, password: current });
  if (wrong) return NextResponse.json({ error: 'wrong-password' }, { status: 403 });

  const { error } = await createServiceClient().auth.admin.updateUserById(user.id, { password: next });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
