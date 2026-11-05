import 'server-only';
import { oembedTrack, type SpotifyTrack } from '@/lib/spotify-parse';
import { createServiceClient } from '@/lib/supabase/server';
import { classify } from './spotify';

/* Spotify-д нэвтрэлгүйгээр өөрийн сан үүсгэх: хэрэглэгч дууны холбоосуудаа буулгана.
   Development Mode-д OAuth 5 хэрэглэгчээр хязгаарлагддаг тул бусад нь ингэж оруулна.
   Дууны нэр, зургийг түлхүүр, квот шаарддаггүй нийтийн oEmbed-ээс авна. */

/** Нэг удаад оруулах, нэг хэрэглэгчийн сангийн дээд хэмжээ (LLM ангилал, oEmbed хүсэлт хязгаарлана) */
export const MAX_IMPORT = 200, MAX_LIBRARY = 600;
const CONCURRENCY = 6;

async function lookup(id: string): Promise<SpotifyTrack | null> {
  try {
    const url = `https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${id}`)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    return res.ok ? oembedTrack(id, await res.json()) : null;
  } catch {
    return null;
  }
}

async function lookupAll(ids: string[]) {
  const out: SpotifyTrack[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, ids.length) }, async () => {
    while (next < ids.length) {
      const t = await lookup(ids[next++]);
      if (t) out.push(t);
    }
  }));
  return out;
}

/** Шинэ дуунуудыг сэтгэл хөдлөлөөр ангилж хэрэглэгчийн санд нэмнэ. Санд байгаа дууг дахин уншихгүй. */
export async function importTracks(userId: string, ids: string[]) {
  const db = createServiceClient();
  const { data: rows, error: readError } = await db.from('spotify_tracks').select('track_id').eq('user_id', userId);
  if (readError) throw readError;
  const have = new Set((rows ?? []).map(r => r.track_id as string));
  const fresh = ids.filter(id => !have.has(id));
  const wanted = fresh.slice(0, Math.min(MAX_IMPORT, Math.max(0, MAX_LIBRARY - have.size)));
  const tracks = await lookupAll(wanted);
  const moods = await classify(tracks);
  if (tracks.length) {
    const { error } = await db.from('spotify_tracks').upsert(tracks.map(t => ({
      user_id: userId, track_id: t.id, name: t.name, artists: t.artists, image: t.image, uri: t.uri, duration_ms: t.duration_ms, moods: moods.get(t.id) ?? ['neutral'],
    })), { onConflict: 'user_id,track_id' });
    if (error) throw error;
  }
  return {
    added: tracks.length,
    existing: ids.length - fresh.length,
    failed: wanted.length - tracks.length,
    skipped: fresh.length - wanted.length,
    total: have.size + tracks.length,
  };
}

/** Холбоосоор оруулсан санг цэвэрлэнэ */
export async function clearImported(userId: string) {
  const { error } = await createServiceClient().from('spotify_tracks').delete().eq('user_id', userId);
  if (error) throw error;
}
