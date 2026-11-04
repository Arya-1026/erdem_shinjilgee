import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { appUrl } from '@/lib/server/spotify';
import { youtubeAuthorizeUrl, youtubeOAuthConfigured } from '@/lib/server/youtube';
import { createClient } from '@/lib/supabase/server';

// "YouTube холбох" → Google-ийн зөвшөөрлийн хуудас (youtube.readonly: зөвхөн уншина)
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const back = (reason: string) => NextResponse.redirect(`${origin}/recs?youtube=${reason}`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);
  if (!youtubeOAuthConfigured()) return back('not-configured');
  if (origin !== new URL(appUrl()).origin) return back('wrong-host');

  const state = randomUUID();
  const res = NextResponse.redirect(youtubeAuthorizeUrl(state));
  res.cookies.set('yt_state', state, { httpOnly: true, sameSite: 'lax', secure: origin.startsWith('https'), maxAge: 600, path: '/api/youtube' });
  return res;
}
