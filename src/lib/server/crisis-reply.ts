import 'server-only';
import { splitActions } from '@/lib/chat-prompt';
import { CRISIS_FALLBACK, crisisReplyPrompt } from '@/lib/crisis';
import { translator, type Locale } from '@/lib/i18n';
import { ensureLocale, llmSmart } from '@/lib/server/llm';

type Turn = { role: string; content: string };

/**
 * Хямрал илэрсэн мессежид өгөх товч, халуун хариулт (тусламжийн утсыг UI хариултын доор харуулна).
 * AI унах, хэт урт эсвэл буруу хэлээр бичвэл тогтмол хариулт: хэрэглэгч хэзээ ч хариугүй үлдэхгүй.
 */
export async function crisisReply(message: string, history: Turn[], name: string, locale: Locale) {
  const fallback = translator(locale)(CRISIS_FALLBACK);
  // Монгол бичвэрт илүү найдвартай том загвар. Чатын жижиг загвар (болон түүний редактор) энд утгагүй өгүүлбэр бичиж байсан.
  const llm = await llmSmart([
    { role: 'system', content: crisisReplyPrompt(locale, name) },
    ...history.slice(-4).map(m => ({ role: m.role as 'user' | 'assistant', content: m.role === 'assistant' ? splitActions(m.content).text : m.content })),
    { role: 'user', content: message },
  ], { temperature: 0.3, maxTokens: 800, timeoutMs: 15_000 }).catch(() => null);
  const text = llm ? splitActions(llm.text).text.trim() : '';
  // Зааварт 60 үг гэсэн: хэт урт бол заавраа дагаагүй гэж үзээд тогтмол хариултыг ашиглана
  if (!text || text.length > 600) return fallback;
  const body = await ensureLocale(text, locale);
  return body?.trim() || fallback;
}
