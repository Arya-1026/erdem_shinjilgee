/* ---------- Хүн бүрт тохирсон дууны санал (LLM) ----------
   Хэрэглэгчийн сонсдог уран бүтээлчид, хобби, 👍/👎, тухайн mood-оос хамаарч өөр өөр дуу гарна. */
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
  /** Хэрэглэгчийн сангаас (YouTube/Spotify) хамгийн их давтагдсан уран бүтээлчид */
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
  const lines = [
    `The listener is ${MOOD_EN[t.mood]}. Suggest ${t.count} real, existing songs that would genuinely help or fit them right now.`,
    t.artists.length ? `Artists they already listen to: ${t.artists.join(', ')}. Mostly suggest songs in a similar style (by these or similar artists), plus 1-2 discoveries.` : 'Their taste is unknown: suggest well-known, widely loved songs with variety.',
    t.genres?.length ? `Genres they chose: ${t.genres.map(g => GENRE_EN[g]).join(', ')}. Every song must belong to one of these genres, spread across them.` : '',
    t.hobbies.length ? `Their hobbies: ${t.hobbies.join(', ')}.` : '',
    t.today?.tags.length ? `Today their mood is related to: ${t.today.tags.join(', ')} (intensity ${t.today.intensity}/5).` : '',
    t.liked.length ? `Songs they liked: ${t.liked.join('; ')}.` : '',
    t.disliked.length ? `Songs they disliked (avoid similar): ${t.disliked.join('; ')}.` : '',
    t.exclude.length ? `Do NOT suggest any of these: ${t.exclude.join('; ')}.` : '',
    'The listener lives in Mongolia. Mongolian songs are added to this list separately from a verified catalogue, so suggest international songs; suggest a Mongolian song only if you are certain it exists and their artists include Mongolian music.',
    'For sad/anxious/angry moods prefer comforting or gently uplifting songs, never songs that glorify self-harm.',
    'For each song give a short reason in Mongolian (max 12 words) why it fits this person now.',
    'Reply with JSON only: {"s":[{"t":"Song title","a":"Artist","why":"..."}]}',
  ];
  return [
    { role: 'system' as const, content: 'You are a thoughtful music curator. Only suggest songs that really exist; never invent titles.' },
    { role: 'user' as const, content: lines.filter(Boolean).join('\n') },
  ];
}

function ambientPrompt(t: Taste) {
  const lines = [
    `The listener is ${MOOD_EN[t.mood]}. Suggest ${t.count} real instrumental tracks or long-form ambient pieces that exist on YouTube and would support them right now: ${AMBIENT_HINT[t.mood]}.`,
    t.hobbies.length ? `Their hobbies: ${t.hobbies.join(', ')} (e.g. study/programming → focus music, yoga/meditation → meditation music, hiking/nature → nature soundscapes).` : '',
    t.today?.tags.length ? `Today their mood is related to: ${t.today.tags.join(', ')} (intensity ${t.today.intensity}/5).` : '',
    t.artists.length ? `Artists they like (for style reference only): ${t.artists.slice(0, 6).join(', ')}.` : '',
    t.disliked.length ? `They disliked (avoid similar): ${t.disliked.join('; ')}.` : '',
    t.exclude.length ? `Do NOT suggest any of these: ${t.exclude.join('; ')}.` : '',
    'Include 1-2 Mongolian instrumentals (morin khuur, yatga, tsuur) when they fit. Prefer well-known pieces/composers/channels so a YouTube search finds them (e.g. "Marconi Union - Weightless", "Ludovico Einaudi - Nuvole Bianche").',
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

export type Suggestion = { title: string; artist: string; why: string };

export function parseSuggestions(text: string, max: number): Suggestion[] {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return [];
  try {
    const rows = (JSON.parse(json) as { s?: { t?: unknown; a?: unknown; why?: unknown }[] }).s ?? [];
    const seen = new Set<string>();
    return rows
      .filter(r => typeof r.t === 'string' && typeof r.a === 'string' && r.t.trim() && r.a.trim())
      .map(r => ({ title: String(r.t).trim().slice(0, 150), artist: String(r.a).trim().slice(0, 150), why: typeof r.why === 'string' ? r.why.trim().slice(0, 160) : '' }))
      .filter(s => { const k = `${s.artist}|${s.title}`.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, max);
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
