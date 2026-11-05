import 'server-only';
import { crisisClassifierPrompt, isCrisisText, parseCrisisVerdict } from '@/lib/crisis';
import { llmClassify } from '@/lib/server/llm';
import { flagsSelfHarm } from '@/lib/server/moderation';

/**
 * Гурван давхаргат хямралын шалгалт: түлхүүр үг (шууд, сүлжээгүй) → Moderation ба утгын ангилал (зэрэг).
 * Аль нэг нь илэрвэл true. Ангилал унавал чат үргэлжилнэ: хэрэглэгчийг хариугүй үлдээхгүй,
 * system prompt-ийн SAFETY хэсэг нөөц болно.
 */
export async function detectCrisis(text: string, earlier: string[] = []) {
  if (isCrisisText(text)) return true;
  const [moderation, classified] = await Promise.all([
    flagsSelfHarm(text),
    llmClassify(crisisClassifierPrompt(text, earlier)).catch(() => null),
  ]);
  if (moderation) return true;
  const verdict = parseCrisisVerdict(classified?.text);
  if (verdict === null) console.error('[crisis] утгын ангилал хийгдсэнгүй');
  return verdict === true;
}
