import { NextResponse } from 'next/server';
import { splitTitle } from '@/lib/youtube-parse';
import { getYouTubeToken, QuotaExceeded, searchSongs, youtubeSearchConfigured } from '@/lib/server/youtube';
import { createClient } from '@/lib/supabase/server';

// GET /api/music/search?q=Хурд → YouTube дээрээс апп дотор тоглуулж болох дуунууд (cache-тэй)
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const q = (new URL(req.url).searchParams.get('q') ?? '').replace(/\s+/g, ' ').trim();
  if (q.length < 2 || q.length > 80) return NextResponse.json({ error: 'invalid query' }, { status: 400 });

  // API key байхгүй бол YouTube-ээ холбосон хэрэглэгчийн token-оор хайна
  const token = youtubeSearchConfigured() ? null : await getYouTubeToken(user.id).catch(() => null);
  if (!youtubeSearchConfigured() && !token) return NextResponse.json({ error: 'not-configured' }, { status: 503 });
  try {
    const found = await searchSongs(q, token);
    const results = found.map(f => {
      const s = splitTitle(f.title, f.channel);
      return { video_id: f.video_id, title: s?.song ?? f.title, artist: s?.artist ?? f.channel, thumbnail: f.thumbnail, duration_s: f.duration_s, reason: '' };
    });
    return NextResponse.json({ results }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if (e instanceof QuotaExceeded) return NextResponse.json({ error: 'quota' }, { status: 429 });
    console.error('[music] search', e);
    return NextResponse.json({ error: 'failed' }, { status: 502 });
  }
}
