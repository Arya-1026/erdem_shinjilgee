import 'server-only';
import { sameTitle, songKey, toTrack, type SpotifyTrack } from '@/lib/spotify-parse';
import { createServiceClient } from '@/lib/supabase/server';
import { api, SpotifyError, spotifyConfigured } from './spotify';

/* Хэрэглэгчийн холболтоос хамааралгүй хайлт: апп-ын client credentials токеноор ажиллана.
   Хариуг бүх хэрэглэгчид song_cache-д хуваалцана (Spotify Development Mode-ийн квот хэмнэнэ). */

/** video_id: Spotify track id. song_recs, song_cache, liked_songs-ийн баганын нэрийг хадгалсан. */
export type FoundSong = { video_id: string; title: string; channel: string; thumbnail: string | null; duration_s: number };

export class QuotaExceeded extends Error {}

/** Нэг хүсэлтэд шинээр хайж болох эх сурвалжийн (уран бүтээлч, төрөл) тоо */
export type Budget = { left: number };

const DAY = 864e5, MONTH = 30 * DAY;
/** "Олдсонгүй" гэсэн хариуг богино хугацаанд л итгэнэ */
const NOT_FOUND_TTL = 3 * DAY;
const PAGE = 10; // 2026.02-оос /search нэг удаад 10-аас их буцаахгүй

/** Квот дуусвал Retry-After дуустал Spotify руу хүсэлт явуулахгүй */
let lockedUntil = 0;

let app: { token: string; until: number } | null = null;
async function appToken() {
  if (app && app.until - Date.now() > 60_000) return app.token;
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new SpotifyError(res.status, 'app token');
  const j: { access_token: string; expires_in: number } = await res.json();
  app = { token: j.access_token, until: Date.now() + j.expires_in * 1000 };
  return app.token;
}

type RawArtist = { id: string; name: string };
type RawTrack = { artists?: RawArtist[] };

async function search<T>(type: 'track' | 'artist', q: string, offset = 0) {
  if (Date.now() < lockedUntil) throw new QuotaExceeded();
  const p = new URLSearchParams({ type, q, limit: String(PAGE), offset: String(offset), market: 'MN' });
  try {
    const r = await api<Record<string, { items?: (T | null)[] }>>(await appToken(), `/search?${p}`);
    return (r[`${type}s`]?.items ?? []).filter((x): x is T => Boolean(x));
  } catch (e) {
    if (e instanceof SpotifyError && e.status === 429) {
      lockedUntil = Date.now() + (e.retryAfterSec ?? 60) * 1000;
      throw new QuotaExceeded();
    }
    throw e;
  }
}

const toFound = (t: SpotifyTrack): FoundSong => ({ video_id: t.id, title: t.name, channel: t.artists, thumbnail: t.image, duration_s: Math.round(t.duration_ms / 1000) });
const fromCache = (h: { video_id: string; title: string; channel: string; thumbnail: string | null; duration_s: number }): FoundSong =>
  ({ video_id: h.video_id, title: h.title, channel: h.channel, thumbnail: h.thumbnail, duration_s: h.duration_s });

/** Хуудсуудын давхардсан дуу, нэг дууны өөр бичлэгийг хасна */
function uniqueSongs(raw: RawTrack[]) {
  const seen = new Set<string>();
  return raw.flatMap(r => {
    const t = toTrack(r);
    if (!t || seen.has(songKey(t.artists, t.name))) return [];
    seen.add(songKey(t.artists, t.name));
    return [toFound(t)];
  });
}

const norm = (s: string) => s.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '');
/** "Post Malone & Swae Lee" гэх мэт нийлмэл нэрт аль нэг уран бүтээлч таарвал болно */
const sameArtist = (wanted: string, got: string) => { const a = norm(wanted), b = norm(got); return Boolean(a && b) && (a.includes(b) || b.includes(a)); };

/**
 * Бүх хэрэглэгчийн хуваалцдаг жагсаалт. load нь null буцаавал хайгаагүй гэсэн үг тул юу ч хадгалахгүй.
 * Хугацаа нь дууссан жагсаалт шинэчлэгдэж чадахгүй үед (квот, хязгаар) хуучнаараа үйлчилнэ.
 */
async function cachedList(prefix: string, ttl: number, load: () => Promise<FoundSong[] | null>) {
  const db = createServiceClient();
  const { data: hit } = await db.from('song_cache').select('*').like('query_key', `${prefix}%`);
  const rows = (hit ?? []).filter(h => h.found).sort((a, b) => Number(a.query_key.slice(prefix.length)) - Number(b.query_key.slice(prefix.length))).map(fromCache);
  const newest = Math.max(0, ...(hit ?? []).map(h => new Date(h.cached_at).getTime()));
  if (hit?.length && Date.now() - newest < (rows.length ? ttl : NOT_FOUND_TTL)) return rows;

  let found: FoundSong[] | null;
  try {
    found = await load();
  } catch (e) {
    if (e instanceof QuotaExceeded && rows.length) return rows;
    throw e;
  }
  if (!found) return rows;
  const cached_at = new Date().toISOString();
  // Шинэ жагсаалт богино байж болох тул хуучин мөрүүд үлдэхгүй
  if (hit?.length) await db.from('song_cache').delete().like('query_key', `${prefix}%`);
  // Олдоогүй ч тэмдэглэнэ: дахин хайж квот үрэхгүй
  if (found.length) await db.from('song_cache').upsert(found.map((f, i) => ({ query_key: prefix + i, found: true, ...f, cached_at })));
  else await db.from('song_cache').upsert({ query_key: prefix + 0, found: false, cached_at });
  return found;
}

/**
 * "Уран бүтээлч - дуу"-г Spotify-аас хайна. Нэр нь таарахгүй бол null: өөр дууг санал болгосон нэрээр тоглуулахгүй.
 * Ая: суваг, тоглуулах жагсаалтын нэр уран бүтээлчтэй таарахгүй нь элбэг тул зөвхөн нэрээр шалгана.
 * sp2: өмнөх хувилбар нэрийг шалгалгүй эхний дууг хадгалдаг байсан тул тэр cache-ийг ашиглахгүй.
 */
export async function findSong(artist: string, title: string, opts: { ambient?: boolean } = {}): Promise<FoundSong | null> {
  if (!spotifyConfigured()) return null;
  const key = 'sp2:' + songKey(artist, title);
  const db = createServiceClient();
  const { data: hit } = await db.from('song_cache').select('*').eq('query_key', key).maybeSingle();
  if (hit && (hit.found || Date.now() - new Date(hit.cached_at).getTime() < MONTH)) return hit.found ? fromCache(hit) : null;

  const pick = (items: RawTrack[], anyArtist = false) => items.find(t => {
    const got = toTrack(t);
    return Boolean(got) && sameTitle(title, got!.name) && (anyArtist || (t.artists ?? []).some(a => sameArtist(artist, a.name)));
  });
  const raw = pick(await search<RawTrack>('track', `track:"${title}" artist:"${artist}"`)) ?? pick(await search<RawTrack>('track', `${artist} ${title}`))
    ?? (opts.ambient ? pick(await search<RawTrack>('track', title), true) : undefined);
  const t = toTrack(raw);
  const found = t ? toFound(t) : null;
  await db.from('song_cache').upsert({ query_key: key, found: Boolean(found), ...(found ?? {}), cached_at: new Date().toISOString() });
  return found;
}

/** Хэрэглэгчийн бичсэн хайлт (дуу, уран бүтээлч) */
export async function searchSongs(query: string): Promise<FoundSong[]> {
  if (!spotifyConfigured()) return [];
  return cachedList(`spsearch:${songKey(query, '')}:`, 7 * DAY, async () =>
    (await search<RawTrack>('track', query)).flatMap(r => { const t = toTrack(r); return t ? [toFound(t)] : []; }));
}

/**
 * Уран бүтээлчийн дуунууд. Нэр ижил өөр хүнийг хасахын тулд эхлээд уран бүтээлчийг нэрээр нь олоод, түүний id-аар шүүнэ.
 * budget: энэ хүсэлтэд шинээр хайж болох уран бүтээлчийн тоо.
 */
export async function artistSongs(name: string, aka: string[], budget: Budget): Promise<FoundSong[]> {
  if (!spotifyConfigured()) return [];
  return cachedList(`spartist:${songKey(name, '')}:`, MONTH, async () => {
    if (budget.left <= 0) return null;
    budget.left--;
    const names = [name, ...aka];
    let artist: RawArtist | undefined;
    for (const n of names) {
      artist = (await search<RawArtist>('artist', n)).find(a => names.some(x => norm(x) === norm(a.name)));
      if (artist) break;
    }
    if (!artist) return [];
    const pages = await Promise.all([0, PAGE, 2 * PAGE].map(o => search<RawTrack>('track', `artist:"${artist!.name}"`, o)));
    return uniqueSongs(pages.flat().filter(t => t.artists?.some(a => a.id === artist!.id)));
  });
}

/**
 * Дууны төрлийн нийтлэг сан: нэг удаа хайгаад 30 хоног бүх хэрэглэгч хуваалцана.
 * query: Spotify-ийн genre шүүлтүүрийн утга (жишээ нь "k-pop"). budget: artistSongs-тэй адил.
 */
export async function genreSongs(query: string, budget: Budget): Promise<FoundSong[]> {
  if (!spotifyConfigured()) return [];
  return cachedList(`spgenre:${songKey(query, '')}:`, MONTH, async () => {
    if (budget.left <= 0) return null;
    budget.left--;
    const pages = await Promise.all([0, PAGE, 2 * PAGE].map(o => search<RawTrack>('track', `genre:"${query}"`, o)));
    return uniqueSongs(pages.flat());
  });
}

