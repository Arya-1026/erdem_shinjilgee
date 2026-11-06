import { NextResponse } from 'next/server';
import { cronAuthorized } from '@/lib/server/cron';
import { createServiceClient } from '@/lib/supabase/server';

// Supabase pg_cron өдөр бүр дууддаг (supabase/migrations/0010_purge_cron.sql).
// Устгах хүсэлт гаргаад 30 хоног нэвтрээгүй бүртгэлийг бүрмөсөн устгана.
// auth.users-ээс устгахад бүх хүснэгт "on delete cascade"-ээр цэвэрлэгдэнэ.
export async function POST(req: Request) {
  if (!(await cronAuthorized(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = createServiceClient();
  const { data, error } = await admin.rpc('due_deletions');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = ((data ?? []) as { user_id: string }[]).map(r => r.user_id);
  let purged = 0;
  for (const id of ids) {
    const { error: e } = await admin.auth.admin.deleteUser(id);
    if (!e) purged++;
  }
  return NextResponse.json({ due: ids.length, purged });
}
