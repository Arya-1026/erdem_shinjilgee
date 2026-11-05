/* ---------- Хүн бүрт тохирсон дууны санал (LLM) ----------
   Хэрэглэгчийн сонсдог уран бүтээлчид, хобби, 👍/👎, тухайн mood-оос хамаарч өөр өөр дуу гарна. */
import { ageLabel, hardAllowed, type AgeGroup } from './artists';
import { GENRE_EN, type Genre } from './mn-songs';
import type { MoodId } from './types';

/** song: үгтэй дуу, ambient: тайвшруулах/төвлөрүүлэх ая (инструменталь, байгалийн дуу, lo-fi, морин хуур) */
export type MusicKind = 'song' | 'ambient';
export const isMusicKind = (v: unknown): v is MusicKind => v === 'song' || v === 'ambient';

export type Taste = {
  mood: MoodId;
  kind?: MusicKind;
  /** Өнөөдрийн бүртгэлээс: юутай холбоотой (таг), эрчим. Тэмдэглэлийн текстийг явуулахгүй. */
  today?: { tags: string[]; intensity: number } | null;
  hobbies: string[];
  /** Хэрэглэгчийн сонгосон дууны төрлүүд */
  genres?: Genre[];
  age?: AgeGroup | null;
  /** Хэрэглэгчийн сонгосон дуртай дуучид */
  favArtists?: string[];
  /** Spotify дээр байгаа нь шалгагдсан дуунууд: AI эндээс `pick` дууг сонгоно */
  pool?: { title: string; artist: string; fav: boolean; goal?: string }[];
  pick?: number;
  /** Хэрэглэгчийн Spotify сангаас хамгийн их давтагдсан уран бүтээлчид */
  artists: string[];
  liked: string[];
  disliked: string[];
  /** Аль хэдийн мэддэг / санал болгосон дуунууд (давтахгүй) */
  exclude: string[];
  count: number;
};

const MOOD_EN: Record<MoodId, string> = {
  happy: 'happy and upbeat', calm: 'calm and relaxed', neutral: 'in an ordinary, neutral mood', tired: 'tired and low on energy',
  anxious: 'anxious and stressed', sad: 'sad', angry: 'angry and frustrated',
};

// Дуу сонгох зарчим (README → Дуу сонгох зарчим). Судалгаагаар түгшүүрт удаан (60-80 bpm) хөгжим тусалдаг,
// түрэмгий төрлүүд түгшүүрийг бууруулдаггүй, гунигтай үед эхлээд мэдрэмжид нь нийцсэн дуу илүү нөлөөлдөг.
const MOOD_GUIDE: Record<MoodId, string> = {
  happy: 'Upbeat, feel-good songs. High energy is fine.',
  calm: 'Gentle, warm, unhurried songs that keep the calm.',
  neutral: 'Pleasant everyday mid-tempo songs.',
  tired: 'Soft, warm songs that lift slowly. Nothing loud or harsh.',
  anxious: 'Slow (about 60-80 bpm), soft, steady, reassuring songs. No aggressive genres, no heavy drums, no shouting.',
  sad: 'Start with empathy: warm, gently melancholic songs that turn hopeful. Never despairing songs.',
  angry: 'Steady mid-tempo, warm, grounding songs that help release tension. NEVER metal, hard rock, screaming or aggressive rap, even if they like those genres. No upbeat dance or party songs either.',
};

/**
 * Mood бүрийн зорилго. Гунигтай үед гунигт нь нийцэх дуу, сэтгэл өргөх дуу хоёуланг нь, уурласан үед тайвшруулах дууг өгнө.
 * en: AI-д өгөх тайлбар, label: хэрэглэгчид харуулах шалтгаан.
 */
export type MoodGoal = { key: string; label: string; en: string };
export const MOOD_GOALS: Record<MoodId, MoodGoal[]> = {
  sad: [
    { key: 'comfort', label: '💙 Гунигт чинь нийцэх', en: 'sad, melancholic songs that keep them company' },
    { key: 'uplift', label: '🌤️ Сэтгэл өргөх', en: 'hopeful, uplifting songs that lift their spirits' },
  ],
  angry: [{ key: 'calm', label: '🌿 Тайвшруулах', en: 'calming, slow, warm songs that cool anger down' }],
  anxious: [{ key: 'calm', label: '🌿 Тайвшруулах', en: 'slow, soft, reassuring songs that ease worry' }],
  tired: [
    { key: 'soft', label: '🌙 Зөөлөн', en: 'soft, restful songs' },
    { key: 'lift', label: '☀️ Эрч нэмэх', en: 'gently energizing songs that lift tiredness' },
  ],
  happy: [{ key: 'joy', label: '🎉 Баяр нэмэх', en: 'upbeat, joyful songs' }],
  calm: [{ key: 'calm', label: '🌿 Тайван', en: 'gentle, peaceful songs' }],
  neutral: [
    { key: 'easy', label: '🎧 Өдөр тутмын', en: 'pleasant everyday songs' },
    { key: 'lift', label: '🌤️ Сэтгэл сэргээх', en: 'songs that brighten the day' },
  ],
};

/** Зорилго бүрээс ээлжлэн авч n зүйл сонгоно. Зорилгогүй нь хамгийн сүүлд. */
export function balanceByGoal<T extends { goal?: string }>(items: T[], goals: MoodGoal[], n: number) {
  const lanes = [...goals.map(g => items.filter(x => x.goal === g.key)), items.filter(x => !goals.some(g => g.key === x.goal))];
  const out: T[] = [];
  for (let i = 0; out.length < n && lanes.some(l => i < l.length); i++)
    for (const l of lanes.slice(0, -1)) if (l[i] && out.length < n) out.push(l[i]);
  for (const x of lanes[lanes.length - 1]) if (out.length < n) out.push(x);
  for (const x of items) if (out.length < n && !out.includes(x)) out.push(x);
  return out;
}

export const goalLabel = (mood: MoodId, key: string | undefined) => MOOD_GOALS[mood].find(g => g.key === key)?.label;

// Ая: mood тус бүрт ямар төрлийн инструменталь хэрэгтэй вэ
const AMBIENT_HINT: Record<MoodId, string> = {
  happy: 'bright, uplifting instrumentals (acoustic guitar, upbeat piano, feel-good lo-fi)',
  calm: 'gentle ambient, soft piano, nature soundscapes to keep the calm',
  neutral: 'pleasant focus music: lo-fi beats, light jazz, acoustic instrumentals',
  tired: 'soft, slow restorative music: sleep piano, rain sounds, warm ambient',
  anxious: 'slow-tempo calming music (~60 bpm): ambient, meditation, nature sounds, morin khuur/yatga instrumentals',
  sad: 'comforting, gently hopeful instrumentals: warm piano, strings, soft cinematic pieces',
  angry: 'grounding music that releases tension: slow drums/ambient, ocean waves, deep calm instrumentals',
};

export function suggestPrompt(t: Taste) {
  if (t.kind === 'ambient') return ambientPrompt(t);
  const genres = (t.genres ?? []).filter(g => g !== 'Метал' || hardAllowed(t.mood));
  const pool = t.pool ?? [], goals = MOOD_GOALS[t.mood];
  const lines = [
    `The listener is ${MOOD_EN[t.mood]}. Suggest ${t.count} real, existing international songs that would genuinely help or fit them right now.`,
    `What fits this mood: ${MOOD_GUIDE[t.mood]}`,
    `Split your picks evenly between these goals and tag each song with its goal: ${goals.map(g => `"${g.key}" = ${g.en}`).join('; ')}.`,
    t.age ? `They are ${ageLabel(t.age)} years old: prefer what people of this age actually listen to.` : '',
    t.favArtists?.length ? `Their favorite artists: ${t.favArtists.join(', ')}. At least half of your songs must be by these artists, when they fit a goal.` : '',
    t.artists.length ? `Artists they already listen to: ${t.artists.join(', ')}. Mostly suggest songs in a similar style (by these or similar artists), plus 1-2 discoveries.` : 'Their taste is unknown: suggest well-known, widely loved songs with variety.',
    genres.length ? `Genres they chose: ${genres.map(g => GENRE_EN[g]).join(', ')}. All other songs must be in these genres. Only the mood rule above may override this.` : '',
    t.hobbies.length ? `Their hobbies: ${t.hobbies.join(', ')}.` : '',
    t.today?.tags.length ? `Today their mood is related to: ${t.today.tags.join(', ')} (intensity ${t.today.intensity}/5).` : '',
    t.liked.length ? `Songs they liked: ${t.liked.join('; ')}.` : '',
    t.disliked.length ? `Songs they disliked (avoid similar): ${t.disliked.join('; ')}.` : '',
    t.exclude.length ? `Do NOT suggest any of these: ${t.exclude.join('; ')}.` : '',
    pool.length ? `The listener lives in Mongolia. From this verified list choose the ${t.pick ?? 4} songs that best fit their mood, age and taste (* = their favorite artist). Skip any that do not fit the mood:\n${pool.map((c, i) => `${i}. ${c.artist} - ${c.title}${c.fav ? ' *' : ''}${c.goal ? ` (found as ${c.goal})` : ''}`).join('\n')}` : '',
    'For sad/anxious/angry moods prefer comforting or gently uplifting songs, never songs that glorify self-harm.',
    pool.length ? 'Reply with JSON only: {"mn":[{"i":0,"goal":"..."}],"s":[{"t":"Song title","a":"Artist","goal":"..."}]}. "mn" holds your picks from the verified list by number. "s" holds only international songs by non-Mongolian artists, never songs from the list.' : 'Reply with JSON only: {"s":[{"t":"Song title","a":"Artist","goal":"..."}]}',
  ];
  return [
    { role: 'system' as const, content: 'You are a thoughtful music curator. Only suggest songs that really exist; never invent titles.' },
    { role: 'user' as const, content: lines.filter(Boolean).join('\n') },
  ];
}

function ambientPrompt(t: Taste) {
  const lines = [
    `The listener is ${MOOD_EN[t.mood]}. Suggest ${t.count} real instrumental tracks or long-form ambient pieces that exist on Spotify and would support them right now: ${AMBIENT_HINT[t.mood]}.`,
    t.hobbies.length ? `Their hobbies: ${t.hobbies.join(', ')} (e.g. study/programming → focus music, yoga/meditation → meditation music, hiking/nature → nature soundscapes).` : '',
    t.today?.tags.length ? `Today their mood is related to: ${t.today.tags.join(', ')} (intensity ${t.today.intensity}/5).` : '',
    t.artists.length ? `Artists they like (for style reference only): ${t.artists.slice(0, 6).join(', ')}.` : '',
    t.disliked.length ? `They disliked (avoid similar): ${t.disliked.join('; ')}.` : '',
    t.exclude.length ? `Do NOT suggest any of these: ${t.exclude.join('; ')}.` : '',
    'Include 1-2 Mongolian instrumentals (morin khuur, yatga, tsuur) when they fit. Prefer well-known pieces/composers/channels so a Spotify search finds them (e.g. "Marconi Union - Weightless", "Ludovico Einaudi - Nuvole Bianche").',
    'For each give a short reason in Mongolian (max 12 words) how it helps now.',
    'Reply with JSON only: {"s":[{"t":"Track title","a":"Artist, composer or channel","why":"..."}]}',
  ];
  return [
    { role: 'system' as const, content: 'You are a music therapist who curates calming and supportive instrumental music. Only suggest pieces that really exist.' },
    { role: 'user' as const, content: lines.filter(Boolean).join('\n') },
  ];
}

/** LLM байхгүй үед ая (хүн бүрт адил) */
export const AMBIENT_FALLBACK: Record<MoodId, { title: string; artist: string }[]> = {
  happy: [{ title: 'Here Comes the Sun (Instrumental)', artist: 'The Piano Guys' }, { title: 'Sunny Day', artist: 'Lofi Fruits Music' }],
  calm: [{ title: 'Nuvole Bianche', artist: 'Ludovico Einaudi' }, { title: 'Spiegel im Spiegel', artist: 'Arvo Pärt' }],
  neutral: [{ title: 'Experience', artist: 'Ludovico Einaudi' }, { title: 'Comptine d\'un autre été', artist: 'Yann Tiersen' }],
  tired: [{ title: 'Gymnopédie No.1', artist: 'Erik Satie' }, { title: 'Clair de Lune', artist: 'Claude Debussy' }],
  anxious: [{ title: 'Weightless', artist: 'Marconi Union' }, { title: 'Watermark', artist: 'Enya' }],
  sad: [{ title: 'Una Mattina', artist: 'Ludovico Einaudi' }, { title: 'River Flows in You', artist: 'Yiruma' }],
  angry: [{ title: 'On the Nature of Daylight', artist: 'Max Richter' }, { title: 'Weightless', artist: 'Marconi Union' }],
};

export type Suggestion = { title: string; artist: string; why: string; goal?: string };

export function parseSuggestions(text: string, max: number): Suggestion[] {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return [];
  try {
    const rows = (JSON.parse(json) as { s?: { t?: unknown; a?: unknown; why?: unknown; goal?: unknown }[] }).s ?? [];
    const seen = new Set<string>();
    return rows
      .filter(r => typeof r.t === 'string' && typeof r.a === 'string' && r.t.trim() && r.a.trim())
      .map(r => ({ title: String(r.t).trim().slice(0, 150), artist: String(r.a).trim().slice(0, 150), why: typeof r.why === 'string' ? r.why.trim().slice(0, 160) : '', goal: typeof r.goal === 'string' ? r.goal : undefined }))
      .filter(s => { const k = `${s.artist}|${s.title}`.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, max);
  } catch {
    return [];
  }
}

/** AI-ийн шалгасан жагсаалтаас сонгосон дуунууд: { i: дугаар, why: шалтгаан } */
export function parsePicks(text: string, count: number) {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return [];
  try {
    const rows = (JSON.parse(json) as { mn?: { i?: unknown; why?: unknown; goal?: unknown }[] }).mn ?? [];
    const seen = new Set<number>();
    return rows.flatMap(r => {
      const i = Number(r.i);
      if (!Number.isInteger(i) || i < 0 || i >= count || seen.has(i)) return [];
      seen.add(i);
      return [{ i, why: typeof r.why === 'string' ? r.why.trim().slice(0, 160) : '', goal: typeof r.goal === 'string' ? r.goal : undefined }];
    });
  } catch {
    return [];
  }
}

/** Хамгийн их давтагдсан уран бүтээлчид (таслалаар нийлсэн нэрсийг салгана) */
export function topArtists(artistFields: string[], n = 12) {
  const c = new Map<string, number>();
  for (const f of artistFields) for (const a of f.split(/,\s*|\s+(?:ft\.?|feat\.?|x|&)\s+/i)) {
    const k = a.trim(); if (k) c.set(k, (c.get(k) ?? 0) + 1);
  }
  return [...c.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([a]) => a);
}
