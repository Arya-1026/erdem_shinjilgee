import { NextResponse } from 'next/server';
import { isMoodId } from '@/lib/data';
import { isMusicKind } from '@/lib/music-suggest';
import { requestLocale } from '@/lib/server/locale';
import { songRecs } from '@/lib/server/music-recs';
import { createClient } from '@/lib/supabase/server';

// GET /api/music/recs?mood=sad[&kind=ambient][&refresh=1] → тухайн хэрэглэгчид тохирсон дуу эсвэл ая
export const maxDuration = 60;

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const mood = url.searchParams.get('mood');
  if (!isMoodId(mood)) return NextResponse.json({ error: 'invalid mood' }, { status: 400 });
  const kindParam = url.searchParams.get('kind') ?? 'song';
  if (!isMusicKind(kindParam)) return NextResponse.json({ error: 'invalid kind' }, { status: 400 });
  try {
    return NextResponse.json(await songRecs(supabase, user.id, mood, url.searchParams.get('refresh') === '1', kindParam, await requestLocale()), { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[music] recs', e);
    return NextResponse.json({ error: 'failed' }, { status: 502 });
  }
}
