import { NextResponse } from 'next/server';
import { SpotifyError, syncLibrary } from '@/lib/server/spotify';
import { createClient } from '@/lib/supabase/server';

// Хэрэглэгчийн playlist, liked songs-ийг татаж mood-оор ангилна. Олон дуутай бол удаан үргэлжилнэ.
export const maxDuration = 120;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await syncLibrary(user.id));
  } catch (e) {
    console.error('[spotify] sync', e);
    const status = e instanceof SpotifyError ? e.status : 500;
    return NextResponse.json({ error: status === 401 ? 'not-connected' : 'sync-failed' }, { status: status === 401 ? 401 : 502 });
  }
}
