/* ---------- Дууг сэтгэл хөдлөлөөр ангилах ----------
   Spotify 2024.11-ээс шинэ апп-д audio-features (valence, energy) өгөхөө больсон.
   Тиймээс дууны нэр + уран бүтээлчээр LLM ангилна. LLM байхгүй/алдаа гарвал түлхүүр үгийн аргаар ангилна. */
import type { MoodId } from './types';

export const MOOD_IDS: MoodId[] = ['happy', 'calm', 'neutral', 'tired', 'anxious', 'sad', 'angry'];
export type TrackInfo = { id: string; name: string; artists: string };

// Тухайн mood-той хэрэглэгчид энэ дуу тохирох уу гэдгээр (дууны өөрийнх нь сэтгэл хөдлөл биш) ангилна
export function classifyPrompt(tracks: TrackInfo[]) {
  return [
    {
      role: 'system' as const,
      content:
        'You label songs for a mood-support app. For each song, choose 1-3 moods of a LISTENER for whom the song is a good fit: ' +
        'happy (upbeat, joyful), calm (relaxed, peaceful), neutral (everyday, easy listening), tired (low energy, needs gentle lift), ' +
        'anxious (needs soothing, slow, reassuring), sad (comforting, melancholic or hopeful), angry (steady, warm, grounding, helps release tension; never metal, hard rock or aggressive songs). ' +
        'Use your knowledge of the actual song if you know it; otherwise infer from title and artist. ' +
        'Reply with JSON only, no prose: {"r":[{"i":0,"m":["sad","calm"]}, ...]} covering every index.',
    },
    { role: 'user' as const, content: tracks.map((t, i) => `${i}. ${t.name} — ${t.artists}`).join('\n') },
  ];
}

/** LLM-ийн хариуг задлана. Буруу/дутуу мөрийг алгасна. */
export function parseClassification(text: string, count: number): Map<number, MoodId[]> {
  const out = new Map<number, MoodId[]>();
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return out;
  try {
    const rows = (JSON.parse(json) as { r?: { i?: unknown; m?: unknown }[] }).r ?? [];
    for (const row of rows) {
      const i = Number(row.i);
      if (!Number.isInteger(i) || i < 0 || i >= count || !Array.isArray(row.m)) continue;
      const moods = [...new Set(row.m.filter((m): m is MoodId => MOOD_IDS.includes(m as MoodId)))].slice(0, 3);
      if (moods.length) out.set(i, moods);
    }
  } catch { /* буруу JSON → хоосон */ }
  return out;
}

const KEYWORDS: [MoodId, RegExp][] = [
  ['sad', /\b(sad|cry|cries|crying|tears?|alone|lonely|goodbye|broken|hurt|miss(ing)?|without you|someone like you|blue|rain)\b|гуниг|уйл|ганцаар|санаж|салах/i],
  ['happy', /\b(happy|dance|dancing|party|sunshine|sun|good|fun|celebrat\w*|joy|smile|feel good|summer)\b|баяр|инээ|бүжиг|аз жаргал/i],
  ['calm', /\b(calm|peace\w*|ocean|sea|slow|breathe|lofi|lo-fi|acoustic|piano|quiet|gentle|still|float\w*)\b|тайван|амгалан|далай/i],
  ['tired', /\b(tired|sleep\w*|night|lullaby|dream\w*|weary|exhaust\w*|moon)\b|нойр|унтах|шөнө|ядар/i],
  ['anxious', /\b(fear|panic|anxi\w*|nervous|worry|pressure|breathe me|weightless|safe)\b|айдас|түгш|санаа зов/i],
  ['angry', /\b(fight|rage|hate|burn\w*|fire|war|kill\w*|scream|lose yourself|enemy|riot)\b|уур|галзуу|тэмц/i],
];

/** Түлхүүр үгийн нөөц ангилал. Юу ч олдохгүй бол "энгийн" гэж үзнэ. */
export function heuristicMoods(t: Pick<TrackInfo, 'name' | 'artists'>): MoodId[] {
  const s = `${t.name} ${t.artists}`;
  const hit = KEYWORDS.filter(([, re]) => re.test(s)).map(([m]) => m).slice(0, 3);
  return hit.length ? hit : ['neutral'];
}
