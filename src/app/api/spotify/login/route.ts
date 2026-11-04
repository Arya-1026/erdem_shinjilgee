import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { appUrl, authorizeUrl, spotifyConfigured } from '@/lib/server/spotify';
import { createClient } from '@/lib/supabase/server';

// "Spotify холбох" товч → Spotify-ийн зөвшөөрлийн хуудас (Authorization Code flow, state-ээр CSRF хамгаална)
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const back = (reason: string) => NextResponse.redirect(`${origin}/recs?spotify=${reason}`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);
  if (!spotifyConfigured()) return back('not-configured');
  // Redirect URI нь NEXT_PUBLIC_APP_URL дээр буцаж ирнэ. Өөр хаягаар орсон бол session cookie алга болно.
  if (origin !== new URL(appUrl()).origin) return back('wrong-host');

  const state = randomUUID();
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set('sp_state', state, { httpOnly: true, sameSite: 'lax', secure: origin.startsWith('https'), maxAge: 600, path: '/api/spotify' });
  return res;
}
