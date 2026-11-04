import { NextResponse } from 'next/server';
import { syncYouTubeLibrary, YouTubeError } from '@/lib/server/youtube';
import { createClient } from '@/lib/supabase/server';

// Like дарсан бичлэг, playlist-ийг татаж, дууг нь mood-оор ангилна. Олон бичлэгтэй бол удаан.
export const maxDuration = 120;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await syncYouTubeLibrary(user.id));
  } catch (e) {
    console.error('[youtube] sync', e);
    const status = e instanceof YouTubeError ? e.status : 500;
    // 400 (invalid_grant) үед холболт устсан байна → дахин холбуулна
    return NextResponse.json({ error: status === 401 || status === 400 ? 'not-connected' : 'sync-failed' }, { status: status === 401 || status === 400 ? 401 : 502 });
  }
}
