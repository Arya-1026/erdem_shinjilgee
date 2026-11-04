import { NextResponse } from 'next/server';
import { removeYouTubeConnection } from '@/lib/server/youtube';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  await removeYouTubeConnection(user.id);
  return NextResponse.json({ ok: true });
}
