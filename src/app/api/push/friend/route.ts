import { NextResponse } from 'next/server';
import { isLocale, translator } from '@/lib/i18n';
import { sendPush } from '@/lib/server/push';
import { createClient, createServiceClient } from '@/lib/supabase/server';

const FRESH_MS = 2 * 60_000;

// POST { target, event: 'request' | 'accepted' }: найзын хүсэлт илгээсэн/зөвшөөрсний дараа нөгөө хүнд push илгээнэ.
// Клиентэд итгэхгүй: тухайн хүсэлт саяхан үнэхээр болсныг өгөгдлийн сангаас шалгана.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { target?: unknown; event?: unknown } | null;
  const target = typeof body?.target === 'string' ? body.target : '';
  const accepted = body?.event === 'accepted';
  if (!target || (!accepted && body?.event !== 'request')) return NextResponse.json({ error: 'invalid' }, { status: 400 });

  const db = createServiceClient();
  const [requester, addressee] = accepted ? [target, user.id] : [user.id, target];
  const { data: row } = await db.from('friendships').select('status,created_at,responded_at').eq('requester', requester).eq('addressee', addressee).maybeSingle();
  const at = accepted ? row?.responded_at : row?.created_at;
  if (!row || row.status !== (accepted ? 'accepted' : 'pending') || !at || Date.now() - new Date(at).getTime() > FRESH_MS)
    return NextResponse.json({ sent: 0 });

  const [{ data: me }, { data: them }] = await Promise.all([
    db.from('profiles').select('name').eq('id', user.id).single(),
    db.from('profiles').select('language').eq('id', target).single(),
  ]);
  const tr = translator(isLocale(them?.language) ? them.language : 'mn');
  const name = me?.name || tr('Хэрэглэгч');
  const r = await sendPush([target], {
    title: tr('Сэтгэл 🌙'),
    body: accepted ? tr('{0} таны найзын хүсэлтийг зөвшөөрлөө 🎉', name) : tr('{0} танд найзын хүсэлт илгээлээ 📨', name),
    url: '/home', tag: `friend-${user.id}`,
  });
  return NextResponse.json(r);
}
