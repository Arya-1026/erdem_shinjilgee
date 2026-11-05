import { NextResponse } from 'next/server';
import { spotifyConfigured } from '@/lib/server/spotify';
import { QuotaExceeded, searchSongs } from '@/lib/server/spotify-search';
import { createClient } from '@/lib/supabase/server';

// GET /api/music/search?q=Хурд → Spotify-аас дуунууд (cache-тэй)
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const q = (new URL(req.url).searchParams.get('q') ?? '').replace(/\s+/g, ' ').trim();
  if (q.length < 2 || q.length > 80) return NextResponse.json({ error: 'invalid query' }, { status: 400 });
  if (!spotifyConfigured()) return NextResponse.json({ error: 'not-configured' }, { status: 503 });
  try {
    const results = (await searchSongs(q)).map(f => ({ video_id: f.video_id, title: f.title, artist: f.channel, thumbnail: f.thumbnail, duration_s: f.duration_s, reason: '' }));
    return NextResponse.json({ results }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof QuotaExceeded) return NextResponse.json({ error: 'quota' }, { status: 429 });
    console.error('[music] search', e);
    return NextResponse.json({ error: 'failed' }, { status: 502 });
  }
}
