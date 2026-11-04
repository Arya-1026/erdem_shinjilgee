import { NextResponse } from 'next/server';
import { getAccessToken } from '@/lib/server/spotify';
import { createClient } from '@/lib/supabase/server';

// Web Playback SDK-д богино хугацаат access token өгнө (refresh token хэзээ ч клиент рүү гарахгүй)
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const t = await getAccessToken(user.id);
    if (!t) return NextResponse.json({ error: 'not-connected' }, { status: 404 });
    return NextResponse.json({ token: t.token, expiresAt: t.expiresAt }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'refresh-failed' }, { status: 502 });
  }
}
