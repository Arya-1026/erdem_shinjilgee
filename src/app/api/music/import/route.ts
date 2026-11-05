import { NextResponse } from 'next/server';
import { clearImported, importTracks } from '@/lib/server/spotify-import';
import { parseTrackIds } from '@/lib/spotify-parse';
import { createClient } from '@/lib/supabase/server';

// Шинэ дуу бүрийг AI ангилдаг тул олон дуутай бол удаан үргэлжилнэ
export const maxDuration = 120;

/** 200 дууны холбоос ойролцоогоор 12 000 тэмдэгт. Үүнээс хэт урт бичвэрийг уншихгүй. */
const MAX_TEXT = 100_000;

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// POST /api/music/import { text } → буулгасан дууны холбоосуудыг сэтгэл хөдлөлөөр ангилж санд нэмнэ
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body: { text?: unknown } | null = await req.json().catch(() => null);
  if (typeof body?.text !== 'string' || body.text.length > MAX_TEXT) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const { ids, otherLinks } = parseTrackIds(body.text);
  if (!ids.length) return NextResponse.json({ error: otherLinks ? 'not-track-links' : 'no-tracks' }, { status: 400 });

  try {
    const result = await importTracks(user.id, ids);
    if (!result.added && result.failed) return NextResponse.json({ error: 'lookup-failed' }, { status: 502 });
    return NextResponse.json(result);
  } catch (e) {
    console.error('[music] import', e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}

// DELETE /api/music/import → санг цэвэрлэнэ
export async function DELETE() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    await clearImported(user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[music] import clear', e);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
