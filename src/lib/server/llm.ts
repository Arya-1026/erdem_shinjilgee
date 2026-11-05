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

// Groq дээрх Qwen: gpt-oss-ийн reasoning_effort-ийг хүлээж авдаггүй тул нэр нь 'groq' биш (callProvider-ийг үз)
const groqQwen = () => ({ ...PROVIDERS[1], name: 'groq-qwen', url: PROVIDERS[0].url, key: PROVIDERS[0].key });
const QWEN = 'qwen/qwen3.8-27b';

/**
 * Чатын хариулт: монголоор хамгийн байгалийн бичдэг Qwen-ийг эхэлж (gpt-oss-120b англиас орчуулсан хэллэг их гаргадаг),
 * бүтэхгүй бол gpt-oss-120b → жижиг загвар → OpenRouter. GROQ_CHAT_MODEL-оор үндсэн загварыг сольж болно.
 */
export async function llmReply(messages: Msg[]) {
  const groq = PROVIDERS[0];
  const main = process.env.GROQ_CHAT_MODEL || QWEN;
  // Groq-ийн үнэгүй хязгаар минутад 8000 токен бөгөөд max_tokens ч тооцогддог тул бага байлгана
  const opts: Opts = { temperature: 0.6, maxTokens: 900, timeoutMs: 30_000, reasoning: 'low' };
  const first = main.startsWith('qwen/') ? groqQwen() : groq;
  return (await callProvider(first, main, messages, { ...opts, maxTokens: main.startsWith('qwen/') ? 1500 : 900 }))
    ?? (await callProvider(groq, 'openai/gpt-oss-120b', messages, opts))
    ?? llmChat(messages, opts);
}

const EDITOR = `Чи монгол хэлний туршлагатай редактор. Доорх чатын хариултыг утга, урт, бүтэц, асуултыг нь өөрчлөхгүйгээр зөв найруулгатай, байгалийн ярианы монгол хэлээр засна.
Засах зүйл: үгийн дараалал (үйл үг өгүүлбэрийн төгсгөлд), нөхцөл дагавар, эгшиг зохицох ёс, англиас шууд орчуулсан хэллэг, монголд байхгүй эсвэл буруу утгатай үг, «чи», «та» холилдох (бүгдийг «чи» болго).
Шинэ санаа, зөвлөгөө нэмэхгүй, хасахгүй. Хэрэв текст аль хэдийн зөв бол хэвээр нь буцаа. Зөвхөн засварласан хариултыг буцаа, тайлбар бичихгүй.`;

/**
 * Хариултын монгол найруулгыг редакторын нэг шатаар засна (~0.5 сек). Бүтэхгүй эсвэл утгыг хэт өөрчилсөн
 * (урт нь эрс өөрчлөгдсөн) бол анхны текстийг буцаана.
 */
export async function polishMongolian(text: string) {
  if (text.length < 20) return text;
  const r = await callProvider(groqQwen(), QWEN, [{ role: 'system', content: EDITOR }, { role: 'user', content: text }], { temperature: 0.2, maxTokens: 1200, timeoutMs: 8_000 });
  const out = r?.text.trim();
  if (!out) return text;
  const ratio = out.length / text.length;
  return ratio > 0.7 && ratio < 1.4 ? out : text;
}

/**
 * Хямралын ангилал: хэрэглэгч хариу хүлээж байгаа тул богино хугацаатай, тогтвортой (temperature 0).
 * max_tokens нь reasoning-ийг ч багтаадаг ба минутын хязгаарт тооцогддог тул бага байлгана.
 */
export async function llmClassify(messages: Msg[]) {
  const opts: Opts = { temperature: 0, maxTokens: 200, timeoutMs: 5_000, reasoning: 'low' };
  return (await callProvider(PROVIDERS[0], process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b', messages, opts)) ?? llmChat(messages, opts);
}

/** Монгол хэлээр бичих шаардлагатай ажил: том загвар → бүтэхгүй бол ердийн загвар */
export async function llmSmart(messages: Msg[], opts: Opts = {}) {
  return (await callProvider(PROVIDERS[0], process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b', messages, opts)) ?? llmChat(messages, opts);
}
