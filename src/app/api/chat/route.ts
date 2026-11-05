import { NextResponse } from 'next/server';
import { fallbackReply } from '@/lib/chat-fallback';
import { asksForExercise, asksForExpert, chatSystemPrompt, extractInlineActions, guessActions, REPLY_LANGUAGE_REMINDER, splitActions } from '@/lib/chat-prompt';
import { ENTRY_COLS, EXPERT_COLS, normalizeEntry, toExpert } from '@/lib/db';
import { detectCrisis } from '@/lib/server/crisis-check';
import { matchesLocale, translator } from '@/lib/i18n';
import { ensureLocale, llmReply, polishMongolian } from '@/lib/server/llm';
import { requestLocale } from '@/lib/server/locale';
import { createClient } from '@/lib/supabase/server';
import type { ChatMode, Entry } from '@/lib/types';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 2000) : '';
  if (!message) return NextResponse.json({ error: 'empty' }, { status: 400 });

  const [profileRes, entriesRes, historyRes, fbRes, expertsRes] = await Promise.all([
    supabase.from('profiles').select('name,hobbies,chat_mode').eq('id', user.id).single(),
    supabase.from('mood_entries').select(ENTRY_COLS).order('entry_date', { ascending: false }).order('entry_time', { ascending: false }).limit(14).returns<Entry[]>(),
    supabase.from('chat_messages').select('role,content,crisis').order('created_at', { ascending: false }).limit(12),
    supabase.from('rec_feedback').select('rec_id,value'),
    supabase.from('experts').select(EXPERT_COLS).order('id'),
  ]);
  const profile = profileRes.data ?? { name: '', hobbies: [], chat_mode: 'calm' };
  const entries = (entriesRes.data ?? []).map(normalizeEntry).reverse();
  // Сүүлийн хэдэн мессеж л: олон хуучин хариулт өгвөл загвар тэр хэв маягийг дууриаж давтагддаг
  const history = (historyRes.data ?? []).reverse().filter(m => !m.crisis).slice(-6);
  const mode = profile.chat_mode as ChatMode;
  const locale = await requestLocale();

  await supabase.from('chat_messages').insert({ role: 'user', content: message });

  // 1) Crisis: түлхүүр үг → Moderation ба утгын ангилал. Аль нэг нь илэрвэл хариу бичихгүй, тусламжийн утас харуулна.
  if (await detectCrisis(message, history.filter(m => m.role === 'user').slice(-2).map(m => m.content))) {
    await supabase.from('chat_messages').insert({ role: 'assistant', content: '', crisis: true });
    return NextResponse.json({ crisis: true });
  }

  // 2) LLM. Хэрэглэгчийн хобби, сүүлийн mood, өнөөдрийн тэмдэглэлийг system prompt-д нэмнэ. API key зөвхөн сервер дээр.
  const todayStr = entries.length ? entries[entries.length - 1].entry_date : '';
  const todayNote = entries.filter(e => e.entry_date === todayStr).map(e => e.note).filter(Boolean).join(' / ');
  const experts = (expertsRes.data ?? []).map(toExpert);
  const system = chatSystemPrompt({ name: profile.name, hobbies: profile.hobbies, entries, mode, todayNote, experts, locale });

  const llm = await llmReply([
    { role: 'system', content: system },
    // Өмнөх хариултуудын ACTIONS мөрийг загварт буцааж өгөхгүй (давтагдахаас сэргийлнэ)
    // Англи үед өмнөх монгол хариултуудыг өгөхгүй: загвар хэлийг нь дагаад монголоор бичдэг
    ...history.filter(m => locale === 'mn' || m.role === 'user' || matchesLocale(m.content, locale))
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.role === 'assistant' ? splitActions(m.content).text : m.content })),
    { role: 'user', content: message },
    ...(locale === 'en' ? [{ role: 'system' as const, content: REPLY_LANGUAGE_REMINDER }] : []),
  ]);

  // 3) Монгол найруулгыг редактороор засна (ACTIONS мөрийг салгаж, засварын дараа буцааж залгана).
  //    LLM унавал дүрэмд суурилсан хариулт.
  let polished: string | null = null;
  if (llm) {
    const split = splitActions(llm.text);
    // Текст дотор бичсэн кодыг («partner») товч болгоно
    const inline = extractInlineActions(split.text, locale);
    const text = inline.text, said = [...new Set([...split.actions, ...inline.actions])].slice(0, 3);
    // Сэтгэл зүйчийн картыг зөвхөн энэ мессежээрээ асуусан үед, байгаа хүнийг л харуулна
    const known = asksForExpert(message) ? split.experts.filter(id => experts.some(e => e.id === id)) : [];
    // AI дасгалын товч гаргахаа мартсан бол: энэ мессеж → өмнөх мессежүүдийн агуулга → «дасгал» гэж асуусан бол ерөнхий дасгал
    const recent = history.filter(m => m.role === 'user').slice(-3).map(m => m.content).reverse();
    const guessed = [message, ...(asksForExercise(message) ? recent : [])].map(guessActions).find(a => a.length) ?? [];
    const actions = said.length || known.length ? said : guessed.length ? guessed : asksForExercise(message) ? ['breath', 'walk'] as const : [];
    // Буруу хэлээр ирсэн бөгөөд орчуулж чадаагүй бол нөөц хариулт ашиглана
    const body = locale === 'mn' ? await polishMongolian(text) : await ensureLocale(text, locale);
    if (body) polished = body + (actions.length ? `\nACTIONS: ${actions.join(', ')}` : '') + (known.length ? `\nEXPERTS: ${known.join(', ')}` : '');
  }
  const reply = polished ?? fallbackReply(message, {
    name: profile.name, hobbies: profile.hobbies, entries, mode,
    feedback: Object.fromEntries((fbRes.data ?? []).map(x => [x.rec_id, x.value])),
  }, translator(locale));

  await supabase.from('chat_messages').insert({ role: 'assistant', content: reply });
  return NextResponse.json({ reply, source: llm?.provider ?? 'fallback' });
}
