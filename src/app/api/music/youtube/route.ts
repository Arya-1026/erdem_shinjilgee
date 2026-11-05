import { NextResponse } from 'next/server';
import { findVideo } from '@/lib/server/youtube';
import { createClient } from '@/lib/supabase/server';

// GET /api/music/youtube?artist=Adele&title=Hello → { videoId }: олдоогүй бол null
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const artist = (url.searchParams.get('artist') ?? '').trim(), title = (url.searchParams.get('title') ?? '').trim();
  if (!title || title.length > 300 || artist.length > 300) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  try {
    return NextResponse.json({ videoId: await findVideo(artist, title) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[music] youtube', e);
    return NextResponse.json({ videoId: null });
  }
}
