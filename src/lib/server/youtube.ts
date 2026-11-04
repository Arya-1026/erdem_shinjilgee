import 'server-only';
import { heuristicMoods, parseVideoClassification, videoClassifyPrompt, type VideoInfo, type VideoLabel } from '@/lib/mood-classify';
import { parseIsoDuration, pickThumb, songKey, splitTitle } from '@/lib/youtube-parse';
import { createServiceClient } from '@/lib/supabase/server';
import { decrypt, encrypt, tokenKeyConfigured } from './crypto';
import { llmChat, llmConfigured } from './llm';
import { appUrl } from './spotify';

const API = 'https://www.googleapis.com/youtube/v3';
const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

export const youtubeOAuthConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && tokenKeyConfigured());
/** Нийтийн хайлт (хүн бүрт тохирсон дууг олох) API key-ээр хийгдэнэ */
export const youtubeSearchConfigured = () => Boolean(process.env.YOUTUBE_API_KEY);
export const youtubeRedirectUri = () => `${appUrl()}/api/youtube/callback`;

export class YouTubeError extends Error {
  constructor(public status: number, msg: string, public reason?: string) { super(msg); }
}

/* ---------- OAuth (Google) ---------- */
export function youtubeAuthorizeUrl(state: string) {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: youtubeRedirectUri(), response_type: 'code', scope: SCOPE,
    access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

type TokenRes = { access_token: string; refresh_token?: string; expires_in: number };
async function tokenRequest(body: Record<string, string>): Promise<TokenRes> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, ...body }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new YouTubeError(res.status, `token: ${await res.text()}`);
  return res.json();
}
export const youtubeExchangeCode = (code: string) => tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: youtubeRedirectUri() });

type Auth = { token: string } | { key: string };
/** YouTube Data API дуудлага. Хэрэглэгчийн token эсвэл API key-ээр. */
export async function yt<T>(path: string, auth: Auth): Promise<T> {
  const url = new URL(API + path);
  if ('key' in auth) url.searchParams.set('key', auth.key);
  const res = await fetch(url, { headers: 'token' in auth ? { Authorization: `Bearer ${auth.token}` } : {}, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const reason = body?.error?.errors?.[0]?.reason;
    throw new YouTubeError(res.status, `${path.split('?')[0]}: ${body?.error?.message ?? res.status}`, reason);
  }
  return res.json();
}

export async function saveYouTubeConnection(userId: string, t: TokenRes) {
  if (!t.refresh_token) throw new YouTubeError(400, 'no refresh token');
  const ch = await yt<{ items?: { snippet: { title: string } }[] }>('/channels?part=snippet&mine=true', { token: t.access_token }).catch(() => null);
  const db = createServiceClient();
  const { error } = await db.from('youtube_connections').upsert({
    user_id: userId, channel_title: ch?.items?.[0]?.snippet.title ?? '',
    access_token: encrypt(t.access_token), refresh_token: encrypt(t.refresh_token),
    expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
  });
  if (error) throw error;
  await db.from('profiles').update({ youtube_connected: true }).eq('id', userId);
}

export async function removeYouTubeConnection(userId: string) {
  const db = createServiceClient();
  const { data: c } = await db.from('youtube_connections').select('refresh_token').eq('user_id', userId).maybeSingle();
  // Google дээрх зөвшөөрлийг ч цуцална
  if (c) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decrypt(c.refresh_token))}`, { method: 'POST' }).catch(() => {});
  await db.from('youtube_tracks').delete().eq('user_id', userId);
  await db.from('youtube_connections').delete().eq('user_id', userId);
  await db.from('profiles').update({ youtube_connected: false }).eq('id', userId);
}

export async function getYouTubeToken(userId: string): Promise<string | null> {
  const db = createServiceClient();
  const { data: c } = await db.from('youtube_connections').select('access_token,refresh_token,expires_at').eq('user_id', userId).maybeSingle();
  if (!c) return null;
  if (new Date(c.expires_at).getTime() - Date.now() > 60_000) return decrypt(c.access_token);
  try {
    const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: decrypt(c.refresh_token) });
    await db.from('youtube_connections').update({ access_token: encrypt(t.access_token), expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString() }).eq('user_id', userId);
    return t.access_token;
  } catch (e) {
    // invalid_grant: зөвшөөрөл цуцлагдсан эсвэл туршилтын горимд 7 хоног өнгөрсөн → дахин холбуулна
    if (e instanceof YouTubeError && e.status === 400) await removeYouTubeConnection(userId);
    throw e;
  }
}

/* ---------- Сан татах ---------- */
type Video = {
  id: string;
  snippet: { title: string; channelTitle: string; categoryId?: string; thumbnails?: Parameters<typeof pickThumb>[0] };
  contentDetails?: { duration?: string };
  status?: { embeddable?: boolean; privacyStatus?: string };
};
type Page<T> = { items?: T[]; nextPageToken?: string };

async function pages<T>(path: string, auth: Auth, max: number) {
  const out: T[] = [];
  let token: string | undefined;
  for (let i = 0; i < max; i++) {
    const p: Page<T> = await yt<Page<T>>(`${path}${token ? `&pageToken=${token}` : ''}`, auth);
    out.push(...(p.items ?? []));
    if (!(token = p.nextPageToken)) break;
  }
  return out;
}

async function videoDetails(ids: string[], auth: Auth) {
  const out: Video[] = [];
  for (let i = 0; i < ids.length; i += 50)
    out.push(...((await yt<Page<Video>>(`/videos?part=snippet,contentDetails,status&id=${ids.slice(i, i + 50).join(',')}`, auth)).items ?? []));
  return out;
}

// Апп дотор тоглуулах боломжтой, дуу байх магадлалтай урттай бичлэг
const playable = (v: Video) => v.status?.embeddable !== false && v.status?.privacyStatus !== 'private' &&
  (d => d >= 45 && d <= 15 * 60)(parseIsoDuration(v.contentDetails?.duration));

const playableAmbient = (v: Video) => v.status?.embeddable !== false && v.status?.privacyStatus !== 'private' &&
  (d => d >= 45 && d <= 3 * 3600)(parseIsoDuration(v.contentDetails?.duration));

const LIMITS = { likedPages: 4, playlists: 20, playlistPages: 2, max: 600, batch: 40 };

/** Like дарсан бичлэг + өөрийн playlist-үүдийг татаж, дууг нь шүүж, mood-оор ангилна */
export async function syncYouTubeLibrary(userId: string) {
  const token = await getYouTubeToken(userId);
  if (!token) throw new YouTubeError(401, 'not connected');
  const auth = { token };

  const videos = new Map<string, Video>();
  (await pages<Video>('/videos?part=snippet,contentDetails,status&myRating=like&maxResults=50', auth, LIMITS.likedPages))
    .forEach(v => { if (videos.size < LIMITS.max) videos.set(v.id, v); });

  const playlists = (await pages<{ id: string; contentDetails?: { itemCount?: number } }>('/playlists?part=contentDetails&mine=true&maxResults=50', auth, 1))
    .filter(p => (p.contentDetails?.itemCount ?? 0) > 0).slice(0, LIMITS.playlists);
  const ids = new Set<string>();
  for (const p of playlists) {
    if (videos.size + ids.size >= LIMITS.max) break;
    (await pages<{ contentDetails: { videoId: string } }>(`/playlistItems?part=contentDetails&playlistId=${p.id}&maxResults=50`, auth, LIMITS.playlistPages))
      .forEach(i => { if (!videos.has(i.contentDetails.videoId)) ids.add(i.contentDetails.videoId); });
  }
  (await videoDetails([...ids].slice(0, LIMITS.max - videos.size), auth)).forEach(v => videos.set(v.id, v));

  const list = [...videos.values()].filter(playable);
  const labels = await classifyVideos(list);
  const rows = list.flatMap(v => {
    const l = labels.get(v.id);
    return l?.music ? [{ user_id: userId, video_id: v.id, title: l.song, artist: l.artist, thumbnail: pickThumb(v.snippet.thumbnails), duration_s: parseIsoDuration(v.contentDetails?.duration), moods: l.moods }] : [];
  });

  const db = createServiceClient();
  await db.from('youtube_tracks').delete().eq('user_id', userId);
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('youtube_tracks').insert(rows.slice(i, i + 500));
    if (error) throw error;
  }
  await db.from('youtube_connections').update({ synced_at: new Date().toISOString() }).eq('user_id', userId);
  return { videos: list.length, songs: rows.length, playlists: playlists.length };
}

/** Cache-д байхгүй бичлэгийг LLM-ээр ангилна. LLM байхгүй бол "Music" ангилал + гарчгийн хэлбэрээр таамаглана. */
async function classifyVideos(list: Video[]) {
  const db = createServiceClient();
  const out = new Map<string, VideoLabel>();
  for (let i = 0; i < list.length; i += 200) {
    const { data } = await db.from('video_info').select('video_id,is_music,title,artist,moods').in('video_id', list.slice(i, i + 200).map(v => v.id));
    data?.forEach(r => out.set(r.video_id, { music: r.is_music, song: r.title, artist: r.artist, moods: r.moods }));
  }
  const todo = list.filter(v => !out.has(v.id));
  const cache: { video_id: string; is_music: boolean; title: string; artist: string; moods: string[] }[] = [];
  for (let i = 0; i < todo.length; i += LIMITS.batch) {
    const batch = todo.slice(i, i + LIMITS.batch);
    const info: VideoInfo[] = batch.map(v => ({ id: v.id, title: v.snippet.title, channel: v.snippet.channelTitle, music_category: v.snippet.categoryId === '10' }));
    const parsed = llmConfigured()
      ? parseVideoClassification((await llmChat(videoClassifyPrompt(info), { temperature: 0, maxTokens: 4000, timeoutMs: 45_000 }))?.text ?? '', batch.length)
      : new Map<number, VideoLabel>();
    batch.forEach((v, j) => {
      const llm = parsed.get(j);
      if (llm) {
        out.set(v.id, llm);
        cache.push({ video_id: v.id, is_music: llm.music, title: llm.song, artist: llm.artist, moods: llm.moods });
        return;
      }
      // Нөөц: зөвхөн YouTube-ийн "Music" ангилалтай бичлэгийг дуу гэж үзнэ (cache-д хадгалахгүй)
      const split = info[j].music_category ? splitTitle(v.snippet.title, v.snippet.channelTitle) : null;
      out.set(v.id, split ? { music: true, ...split, moods: heuristicMoods({ name: split.song, artists: split.artist }) } : { music: false, artist: '', song: '', moods: [] });
    });
  }
  if (cache.length) await db.from('video_info').upsert(cache);
  return out;
}

/* ---------- Дуу хайх (бүх хэрэглэгч хуваалцах cache-тэй) ---------- */
export type FoundSong = { video_id: string; title: string; channel: string; thumbnail: string | null; duration_s: number };

export class QuotaExceeded extends Error {}

/** "Уран бүтээлч - дуу"-г YouTube дээрээс хайна. Олдохгүй бол null. search.list өдөрт 100 удаа тул cache заавал. */
export async function findSong(artist: string, title: string, userToken?: string | null, opts: { ambient?: boolean } = {}): Promise<FoundSong | null> {
  // Ая (байгалийн дуу, бясалгалын хөгжим) нь "Music" ангилалд ороогүй, 1–3 цаг үргэлжлэх нь элбэг → тусдаа cache, шүүлтүүр
  const key = (opts.ambient ? 'amb:' : '') + songKey(artist, title);
  const db = createServiceClient();
  const { data: hit } = await db.from('song_cache').select('*').eq('query_key', key).maybeSingle();
  if (hit && (hit.found || Date.now() - new Date(hit.cached_at).getTime() < 30 * 864e5))
    return hit.found ? { video_id: hit.video_id, title: hit.title, channel: hit.channel, thumbnail: hit.thumbnail, duration_s: hit.duration_s } : null;

  const auth: Auth | null = process.env.YOUTUBE_API_KEY ? { key: process.env.YOUTUBE_API_KEY } : userToken ? { token: userToken } : null;
  if (!auth) return null;
  const q = new URLSearchParams({ part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: '1', q: `${artist} ${title}` });
  // Монгол дууны ихэнх бичлэг "Music" ангилалд ордоггүй (Болд, Хурдын албан ёсны MV ч Entertainment-д байдаг)
  if (/[\u0400-\u04FF]/.test(artist + title)) { q.set('regionCode', 'MN'); q.set('relevanceLanguage', 'mn'); }
  else if (!opts.ambient) q.set('videoCategoryId', '10');
  let res: Page<{ id: { videoId: string } }>;
  try {
    res = await yt(`/search?${q}`, auth);
  } catch (e) {
    if (e instanceof YouTubeError && e.status === 403 && /quota/i.test(e.reason ?? e.message)) throw new QuotaExceeded();
    throw e;
  }
  const id = res.items?.[0]?.id.videoId;
  const v = id ? (await videoDetails([id], auth))[0] : undefined;
  const found = v && (opts.ambient ? playableAmbient(v) : playable(v))
    ? { video_id: v.id, title: v.snippet.title, channel: v.snippet.channelTitle, thumbnail: pickThumb(v.snippet.thumbnails), duration_s: parseIsoDuration(v.contentDetails?.duration) }
    : null;
  await db.from('song_cache').upsert({ query_key: key, found: Boolean(found), ...(found ?? {}), cached_at: new Date().toISOString() });
  return found;
}

/**
 * Уран бүтээлчийн дуунууд. Нэг хайлтаар 15 бичлэг авч бүх хэрэглэгчид 30 хоног cache-лнэ (song_cache: artist:нэр:дугаар).
 * budget: энэ хүсэлтэд шинээр хайж болох тоо. Нэр нь гарчиг, сувагт байхгүй бичлэгийг хасна.
 */
export async function artistVideos(artist: string, aka: string[], userToken: string | null, budget: { left: number }, mongolian = true): Promise<FoundSong[]> {
  const prefix = `artist:${songKey(artist, '')}:`;
  const db = createServiceClient();
  const { data: hit } = await db.from('song_cache').select('*').like('query_key', `${prefix}%`);
  if (hit?.length && Date.now() - new Date(hit[0].cached_at).getTime() < 30 * 864e5)
    return hit.filter(h => h.found).map(h => ({ video_id: h.video_id, title: h.title, channel: h.channel, thumbnail: h.thumbnail, duration_s: h.duration_s }));
  if (budget.left <= 0) return [];

  const auth: Auth | null = process.env.YOUTUBE_API_KEY ? { key: process.env.YOUTUBE_API_KEY } : userToken ? { token: userToken } : null;
  if (!auth) return [];
  budget.left--;
  const q = new URLSearchParams({ part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: '15', q: mongolian ? `${artist} дуу` : `${artist} official` });
  if (mongolian) { q.set('regionCode', 'MN'); q.set('relevanceLanguage', 'mn'); } else q.set('videoCategoryId', '10');
  let res: Page<{ id: { videoId: string } }>;
  try {
    res = await yt(`/search?${q}`, auth);
  } catch (e) {
    if (e instanceof YouTubeError && e.status === 403 && /quota/i.test(e.reason ?? e.message)) throw new QuotaExceeded();
    throw e;
  }
  const names = [artist, ...aka].map(n => n.toLowerCase());
  const videos = (await videoDetails((res.items ?? []).map(i => i.id.videoId), auth)).filter(playable)
    .filter(v => names.some(n => `${v.snippet.title} ${v.snippet.channelTitle}`.toLowerCase().includes(n)));
  const found = videos.map(v => ({ video_id: v.id, title: v.snippet.title, channel: v.snippet.channelTitle, thumbnail: pickThumb(v.snippet.thumbnails), duration_s: parseIsoDuration(v.contentDetails?.duration) }));
  const cached_at = new Date().toISOString();
  // Олдоогүй ч тэмдэглэнэ: дахин хайж квот үрэхгүй
  if (found.length) await db.from('song_cache').upsert(found.map((f, i) => ({ query_key: prefix + i, found: true, ...f, cached_at })));
  else await db.from('song_cache').upsert({ query_key: prefix + 0, found: false, cached_at });
  return found;
}

/** Бичлэгүүдийг дуу мөн эсэх, уран бүтээлч, нэр, mood-оор ангилна (LLM, video_info cache) */
export async function labelSongs(list: FoundSong[]) {
  const videos: Video[] = list.map(v => ({ id: v.video_id, snippet: { title: v.title, channelTitle: v.channel, categoryId: '10' } }));
  return classifyVideos(videos);
}
