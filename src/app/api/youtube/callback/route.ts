import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { saveYouTubeConnection, youtubeExchangeCode } from '@/lib/server/youtube';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (reason: string) => {
    const res = NextResponse.redirect(`${url.origin}/recs?youtube=${reason}`);
    res.cookies.delete({ name: 'yt_state', path: '/api/youtube' });
    return res;
  };

  const state = (await cookies()).get('yt_state')?.value;
  if (!state || state !== url.searchParams.get('state')) return back('state');
  // access_denied: хэрэглэгч татгалзсан эсвэл туршилтын горимд Test users-д нэмэгдээгүй
  if (url.searchParams.get('error')) return back(url.searchParams.get('error') === 'access_denied' ? 'denied' : 'error');
  const code = url.searchParams.get('code');
  if (!code) return back('denied');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${url.origin}/login`);

  try {
    await saveYouTubeConnection(user.id, await youtubeExchangeCode(code));
  } catch (e) {
    console.error('[youtube] callback', e);
    return back('error');
  }
  return back('connected');
}
