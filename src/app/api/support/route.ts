import { NextResponse } from 'next/server';
import { WD } from '@/lib/data';
import { ENTRY_COLS, normalizeEntry } from '@/lib/db';
import { weekdayOf } from '@/lib/date';
import { detectCrisis } from '@/lib/server/crisis-check';
import { matchesLocale } from '@/lib/i18n';
import { llmChat, llmConfigured } from '@/lib/server/llm';
import { requestLocale } from '@/lib/server/locale';
import { fallbackSupport, isSupportDate, parseSupport, supportPrompt, type Support } from '@/lib/support';
import { createClient } from '@/lib/supabase/server';
import type { Entry } from '@/lib/types';

// GET  /api/support?date=YYYY-MM-DD           → өнөөдрийн дэмжлэг (хадгалсан эсвэл шинээр үүсгэнэ)
// POST /api/support { date, refresh: true }   → өөр үгээр дахин үүсгэнэ
// Огноог клиент өгнө: хэрэглэгчийн цагийн бүсийн "өнөөдөр".
export const maxDuration = 30;

type Out = (Support & { mood: string; source: string }) | { none: true } | { crisis: true };
const MIN_REFRESH_MS = 20_000;

async function handle(req: Request, date: unknown, refresh: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isSupportDate(date)) return NextResponse.json({ error: 'invalid date' }, { status: 400 });

  const since = new Date(new Date(date + 'T12:00:00Z').getTime() - 7 * 864e5).toISOString().slice(0, 10);
  const [profileRes, entriesRes, savedRes] = await Promise.all([
    supabase.from('profiles').select('name,hobbies').eq('id', user.id).single(),
    supabase.from('mood_entries').select(ENTRY_COLS).gte('entry_date', since).lte('entry_date', date)
      .order('entry_date').order('entry_time').returns<Entry[]>(),
    supabase.from('daily_support').select('entry_id,mood,message,steps,source,created_at').eq('support_date', date).maybeSingle(),
  ]);
  const entries = (entriesRes.data ?? []).map(normalizeEntry);
  const today = entries.filter(e => e.entry_date === date);
  if (!today.length) return NextResponse.json({ none: true } satisfies Out);
  const latest = today[today.length - 1];
  const locale = await requestLocale();
  // Хэрэглэгч хэлээ сольсон бол өөр хэлээр хадгалсан дэмжлэгийг дахин үүсгэнэ
  const saved = savedRes.data && matchesLocale(savedRes.data.message, locale) ? savedRes.data : null;

  // Сүүлийн бүртгэл өөрчлөгдөөгүй бол хадгалсныг буцаана (LLM-ийн өдрийн хязгаар хэмнэнэ)
  const tooSoon = saved && Date.now() - new Date(saved.created_at).getTime() < MIN_REFRESH_MS;
  if (saved && saved.entry_id === latest.id && (!refresh || tooSoon))
    return NextResponse.json({ message: saved.message, steps: saved.steps as string[], mood: saved.mood, source: saved.source } satisfies Out);

  // Тэмдэглэлд өөрийгөө гэмтээх агуулга байвал LLM-ийг дуудахгүй, тусламжийн утас харуулна
  const notes = today.map(e => e.note).join('\n');
  if (notes.trim() && (await detectCrisis(notes))) return NextResponse.json({ crisis: true } satisfies Out);

  const profile = profileRes.data ?? { name: '', hobbies: [] as string[] };
  let support: Support | null = null, source = 'fallback';
  if (llmConfigured()) {
    const r = await llmChat(supportPrompt({ name: profile.name, hobbies: profile.hobbies, today, recent: entries.filter(e => e.entry_date < date), weekday: WD[weekdayOf(date)], locale }),
      { temperature: refresh ? 0.95 : 0.75, maxTokens: 900, timeoutMs: 25_000 });
    support = r ? parseSupport(r.text) : null;
    // Загвар өөр хэлээр бичвэл сонгосон хэлний бэлэн үгийг ашиглана
    if (support && ![support.message, ...support.steps].every(x => matchesLocale(x, locale))) support = null;
    if (support && r) source = r.provider;
  }
  support ??= fallbackSupport(latest.mood, profile.hobbies, locale);

  await supabase.from('daily_support').upsert({ user_id: user.id, support_date: date, entry_id: latest.id, mood: latest.mood, message: support.message, steps: support.steps, source, created_at: new Date().toISOString() },
    { onConflict: 'user_id,support_date' });
  return NextResponse.json({ ...support, mood: latest.mood, source } satisfies Out);
}

export async function GET(req: Request) {
  return handle(req, new URL(req.url).searchParams.get('date'), false);
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  return handle(req, body?.date, Boolean(body?.refresh));
}
