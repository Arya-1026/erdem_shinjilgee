import 'server-only';
import { songKey } from '@/lib/spotify-parse';
import { createServiceClient } from '@/lib/supabase/server';
import { pickVideo, videoQuery, type VideoHit } from '@/lib/youtube-parse';

/* Spotify-ийн дууг апп дотор бүтэн тоглуулах YouTube бичлэг хайна.
   search.list өдөрт ердөө 100 удаа тул хариуг бүх хэрэглэгчид song_cache-д хадгална. */

const MONTH = 30 * 864e5;
/** Квот дууссан бол энэ хугацаанд дахин хайхгүй (квот Номхон далайн цагаар шөнө дунд сэргэнэ) */
const QUOTA_RETRY_MS = 3600e3;
let lockedUntil = 0;

export const youtubeConfigured = () => Boolean(process.env.YOUTUBE_API_KEY);

type SearchItem = { id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; thumbnails?: { medium?: { url?: string } } } };

/** Олдсон бичлэгийн id. Олдоогүй, тохируулаагүй, квот дууссан бол null: тоглуулагч Spotify-ийн Preview руу шилжинэ. */
export async function findVideo(artist: string, title: string): Promise<string | null> {
  if (!youtubeConfigured()) return null;
  const query_key = 'yt:' + songKey(artist, title);
  const db = createServiceClient();
  const { data: hit } = await db.from('song_cache').select('found,video_id,cached_at').eq('query_key', query_key).maybeSingle();
  if (hit?.found) return hit.video_id;
  if (hit && Date.now() - new Date(hit.cached_at).getTime() < MONTH) return null;
  if (Date.now() < lockedUntil) return null;

  const q = videoQuery(artist, title);
  const params = new URLSearchParams({ part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: '5', q, key: process.env.YOUTUBE_API_KEY! });
  // Монгол дууны ихэнх албан ёсны бичлэг "Music" ангилалд ордоггүй тул ангиллаар шүүхгүй
  if (/[Ѐ-ӿ]/.test(q)) { params.set('regionCode', 'MN'); params.set('relevanceLanguage', 'mn'); }
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    // Хайлтын өдрийн хязгаар 429, нийт квот 403 буцаана. «Олдсонгүй» гэж хадгалахгүй.
    if (res.status === 403 || res.status === 429) { lockedUntil = Date.now() + QUOTA_RETRY_MS; return null; }
    throw new Error(`youtube search ${res.status}`);
  }
  const { items = [] }: { items?: SearchItem[] } = await res.json();
  const hits: VideoHit[] = items.flatMap(i => (i.id?.videoId ? [{ id: i.id.videoId, title: i.snippet?.title ?? '', channel: i.snippet?.channelTitle ?? '' }] : []));
  const id = pickVideo(hits, artist, title);
  const chosen = items.find(i => i.id?.videoId === id)?.snippet;
  await db.from('song_cache').upsert({
    query_key, found: Boolean(id), cached_at: new Date().toISOString(),
    ...(id ? { video_id: id, title: chosen?.title ?? null, channel: chosen?.channelTitle ?? null, thumbnail: chosen?.thumbnails?.medium?.url ?? null } : {}),
  });
  return id;
}
