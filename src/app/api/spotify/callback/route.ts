import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { api, exchangeCode, saveConnection } from '@/lib/server/spotify';
import { requestOrigin } from '@/lib/server/request-origin';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const url = new URL(req.url), origin = requestOrigin(req);
  const back = (reason: string) => {
    const res = NextResponse.redirect(`${origin}/recs?spotify=${reason}`);
    res.cookies.delete({ name: 'sp_state', path: '/api/spotify' });
    return res;
  };

  const state = (await cookies()).get('sp_state')?.value;
  if (!state || state !== url.searchParams.get('state')) return back('state');
  if (url.searchParams.get('error')) return back('denied');
  const code = url.searchParams.get('code');
  if (!code) return back('denied');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  try {
    const tokens = await exchangeCode(code);
    const me = await api<{ id: string; display_name?: string | null }>(tokens.access_token, '/me');
    await saveConnection(user.id, tokens, me);
  } catch (e) {
    console.error('[spotify] callback', e);
    // Development Mode-д User Management-д нэмэгдээгүй хэрэглэгч 403 авна
    return back(e instanceof Error && 'status' in e && e.status === 403 ? 'not-allowlisted' : 'error');
  }
  // Синкийг клиент шууд эхлүүлнэ (хэдэн арван секунд үргэлжилж болох тул энд хүлээлгэхгүй)
  return back('connected');
}
