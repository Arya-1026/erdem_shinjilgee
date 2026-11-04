import { NextResponse } from 'next/server';
import { fallbackReply } from '@/lib/chat-fallback';
import { isCrisisText } from '@/lib/crisis';
import { chatSystemPrompt, splitActions } from '@/lib/chat-prompt';
import { ENTRY_COLS, normalizeEntry } from '@/lib/db';
import { llmReply } from '@/lib/server/llm';
import { flagsSelfHarm } from '@/lib/server/moderation';
import { createClient } from '@/lib/supabase/server';
import type { ChatMode, Entry } from '@/lib/types';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null);
  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 2000) : '';
  if (!message) return NextResponse.json({ error: 'empty' }, { status: 400 });

  const [profileRes, entriesRes, historyRes, fbRes] = await Promise.all([
    supabase.from('profiles').select('name,hobbies,chat_mode').eq('id', user.id).single(),
    supabase.from('mood_entries').select(ENTRY_COLS).order('entry_date', { ascending: false }).order('entry_time', { ascending: false }).limit(14).returns<Entry[]>(),
    supabase.from('chat_messages').select('role,content,crisis').order('created_at', { ascending: false }).limit(12),
    supabase.from('rec_feedback').select('rec_id,value'),
  ]);
  const profile = profileRes.data ?? { name: '', hobbies: [], chat_mode: 'calm' };
  const entries = (entriesRes.data ?? []).map(normalizeEntry).reverse();
  const history = (historyRes.data ?? []).reverse().filter(m => !m.crisis);
  const mode = profile.chat_mode as ChatMode;

  await supabase.from('chat_messages').insert({ role: 'user', content: message });

  // 1) Crisis: түлхүүр үг (шууд) → Moderation API. Аль нэг нь илэрвэл LLM-ийг огт дуудахгүй.
  if (isCrisisText(message) || (await flagsSelfHarm(message))) {
    await supabase.from('chat_messages').insert({ role: 'assistant', content: '', crisis: true });
    return NextResponse.json({ crisis: true });
  }

  // 2) LLM. Хэрэглэгчийн хобби, сүүлийн mood, өнөөдрийн тэмдэглэлийг system prompt-д нэмнэ. API key зөвхөн сервер дээр.
  const todayStr = entries.length ? entries[entries.length - 1].entry_date : '';
  const todayNote = entries.filter(e => e.entry_date === todayStr).map(e => e.note).filter(Boolean).join(' / ');
  const system = chatSystemPrompt({ name: profile.name, hobbies: profile.hobbies, entries, mode, todayNote });

  const llm = await llmReply([
    { role: 'system', content: system },
    // Өмнөх хариултуудын ACTIONS мөрийг загварт буцааж өгөхгүй (давтагдахаас сэргийлнэ)
    ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.role === 'assistant' ? splitActions(m.content).text : m.content })),
    { role: 'user', content: message },
  ]);

  // 3) LLM унавал дүрэмд суурилсан хариулт
  const reply = llm?.text ?? fallbackReply(message, {
    name: profile.name, hobbies: profile.hobbies, entries, mode,
    feedback: Object.fromEntries((fbRes.data ?? []).map(x => [x.rec_id, x.value])),
  });

  await supabase.from('chat_messages').insert({ role: 'assistant', content: reply });
  return NextResponse.json({ reply, source: llm?.provider ?? 'fallback' });
}
