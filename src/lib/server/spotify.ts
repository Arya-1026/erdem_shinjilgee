import 'server-only';
import { classifyPrompt, heuristicMoods, parseClassification } from '@/lib/mood-classify';
import type { SpotifyTrack } from '@/lib/spotify-parse';
import { createServiceClient } from '@/lib/supabase/server';
import type { MoodId } from '@/lib/types';
import { llmChat, llmConfigured } from './llm';

/* Хэрэглэгч Spotify бүртгэлээ холбодоггүй: хайлт нь апп-ын client credentials токеноор (spotify-search.ts),
   тоглуулалт нь Embed-ээр явна. */
const API = 'https://api.spotify.com/v1';

export const spotifyConfigured = () => Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);

export class SpotifyError extends Error {
  /** retryAfterSec: 429 үед Spotify-ийн хэлсэн хүлээх хугацаа */
  constructor(public status: number, msg: string, public retryAfterSec?: number) { super(msg); }
}

/** Үүнээс удаан Retry-After бол хүлээлгүй шууд алдаа шиднэ: квот дууссан үед хэдэн цаг хүртэл үргэлжилдэг */
const MAX_WAIT_SEC = 10;
const BATCH = 40;

/** Spotify Web API дуудлага. 429 үед богино Retry-After-ийг хүлээгээд нэг удаа давтана, урт бол шууд алдаа шиднэ. */
export async function api<T>(token: string, path: string, init?: RequestInit, retry = true): Promise<T> {
  const res = await fetch(path.startsWith('http') ? path : API + path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 429) {
    const wait = Number(res.headers.get('retry-after')) || 2;
    if (!retry || wait > MAX_WAIT_SEC) throw new SpotifyError(429, `${path}: rate limited`, wait);
    await new Promise(r => setTimeout(r, wait * 1000));
    return api<T>(token, path, init, false);
  }
  if (!res.ok) throw new SpotifyError(res.status, `${path}: ${(await res.text()).slice(0, 200)}`);
  return (res.status === 204 ? null : await res.json()) as T;
}

/** Cache-д байхгүй дуунуудыг LLM-ээр (40-өөр нь багцлан) ангилж, cache-д нэмнэ */
export async function classify(list: Pick<SpotifyTrack, 'id' | 'name' | 'artists'>[]) {
  const db = createServiceClient();
  const result = new Map<string, MoodId[]>();
  const chunks = (a: typeof list, n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
  // Cache-ийн уншилт, LLM-ийн багцуудыг зэрэг ажиллуулна
  for (const { data } of await Promise.all(chunks(list, 200).map(c => db.from('track_moods').select('track_id,moods').in('track_id', c.map(t => t.id)))))
    data?.forEach(r => result.set(r.track_id, r.moods as MoodId[]));
  const todo = list.filter(t => !result.has(t.id));
  const rows: { track_id: string; moods: MoodId[]; source: 'llm' | 'heuristic' }[] = [];
  const batches = chunks(todo, BATCH);
  const replies = await Promise.all(batches.map(async batch => llmConfigured()
    ? parseClassification((await llmChat(classifyPrompt(batch), { temperature: 0, maxTokens: 2500, timeoutMs: 40_000 }))?.text ?? '', batch.length)
    : new Map<number, MoodId[]>()));
  batches.forEach((batch, b) => {
    const parsed = replies[b];
    batch.forEach((t, j) => {
      const m = parsed.get(j);
      rows.push({ track_id: t.id, moods: m ?? heuristicMoods(t), source: m ? 'llm' : 'heuristic' });
      result.set(t.id, m ?? heuristicMoods(t));
    });
  });
  // Түлхүүр үгээр ангилсныг cache-д хадгалахгүй: дараа нь LLM тохируулахад дахин ангилагдана
  const llmRows = rows.filter(r => r.source === 'llm');
  if (llmRows.length) await db.from('track_moods').upsert(llmRows);
  return result;
}
