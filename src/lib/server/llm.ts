import 'server-only';

// Groq болон OpenRouter хоёулаа OpenAI-тай ижил форматтай тул нэг функцээр дуудна.
// Эхлээд Groq (өдөрт ~1000 хүсэлт), бүтэхгүй бол OpenRouter (нөөц). Хоёулаа унавал null буцаана.
export type Msg = { role: 'system' | 'user' | 'assistant'; content: string };

const PROVIDERS = [
  {
    name: 'groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: () => process.env.GROQ_API_KEY,
    model: () => process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
    extra: { reasoning_effort: 'low' },
  },
  {
    name: 'openrouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: () => process.env.OPENROUTER_API_KEY,
    model: () => process.env.OPENROUTER_MODEL || 'openai/gpt-oss-20b:free',
    extra: {},
  },
];

export const llmConfigured = () => PROVIDERS.some(p => p.key());

type Opts = { temperature?: number; maxTokens?: number; timeoutMs?: number; reasoning?: 'low' | 'medium' | 'high' };

export async function llmChat(messages: Msg[], opts: Opts = {}) {
  for (const p of PROVIDERS) {
    const r = await callProvider(p, p.model(), messages, opts);
    if (r) return r;
  }
  return null;
}

async function callProvider(p: (typeof PROVIDERS)[number], model: string, messages: Msg[], opts: Opts) {
    const key = p.key();
    if (!key) return null;
    try {
      const res = await fetch(p.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, messages, temperature: opts.temperature ?? 0.7, max_tokens: opts.maxTokens ?? 700, ...p.extra, ...(p.name === 'groq' && opts.reasoning ? { reasoning_effort: opts.reasoning } : {}) }),
        signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
      });
      if (!res.ok) { console.error(`[llm] ${p.name}/${model} ${res.status}: ${(await res.text()).slice(0, 300)}`); return null; }
      const json = await res.json();
      // Qwen бодлоо <think> дотор бичдэг
      const text: string | undefined = json.choices?.[0]?.message?.content?.replace(/<think>[\s\S]*?<\/think>/, '').trim();
      return text ? { text, provider: `${p.name}:${model}` } : null;
    } catch (e) {
      console.error(`[llm] ${p.name}/${model} алдаа:`, e);
      return null;
    }
}

/**
 * Чатын хариулт: монгол хэлээр илүү чанартай бичдэг том загвар (Groq gpt-oss-120b, үнэгүй хязгаартай)-ыг эхэлж,
 * бүтэхгүй бол жижиг загвар → OpenRouter. GROQ_CHAT_MODEL-оор сольж болно.
 */
export async function llmReply(messages: Msg[]) {
  const groq = PROVIDERS[0];
  const big = process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b';
  // Groq-ийн үнэгүй хязгаар минутад 8000 токен бөгөөд max_tokens ч тооцогддог тул бага байлгана.
  // Хязгаар тулвал монгол хэл нь муу 20b руу шууд унахгүй, эхлээд Qwen-ийг оролдоно.
  const opts: Opts = { temperature: 0.6, maxTokens: 900, timeoutMs: 30_000, reasoning: 'low' };
  return (await callProvider(groq, big, messages, opts))
    ?? (await callProvider({ ...PROVIDERS[1], name: 'groq-qwen', url: groq.url, key: groq.key }, 'qwen/qwen3.8-27b', messages, { ...opts, maxTokens: 1500 }))
    ?? llmChat(messages, opts);
}

/** Монгол хэлээр бичих шаардлагатай ажил: том загвар → бүтэхгүй бол ердийн загвар */
export async function llmSmart(messages: Msg[], opts: Opts = {}) {
  return (await callProvider(PROVIDERS[0], process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b', messages, opts)) ?? llmChat(messages, opts);
}
