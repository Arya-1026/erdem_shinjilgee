import 'server-only';

// OpenAI Moderation API (үнэгүй). Өөрийгөө гэмтээх ангиллыг шалгана.
// Түлхүүр байхгүй эсвэл API унавал false буцаана. Тэр үед түлхүүр үгийн шүүлтүүр (lib/crisis.ts) хамгаална.
export async function flagsSelfHarm(input: string): Promise<boolean> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return false;
  try {
    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: 'omni-moderation-latest', input }),
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return false;
    const c = (await res.json()).results?.[0]?.categories ?? {};
    return Boolean(c['self-harm'] || c['self-harm/intent'] || c['self-harm/instructions']);
  } catch {
    return false;
  }
}
