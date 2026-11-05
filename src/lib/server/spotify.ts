import 'server-only';
import { classifyPrompt, heuristicMoods, parseClassification } from '@/lib/mood-classify';
import { playlistEntryTrack, toTrack, type SpotifyTrack } from '@/lib/spotify-parse';
import { createServiceClient } from '@/lib/supabase/server';
import type { MoodId } from '@/lib/types';
import { decrypt, encrypt, tokenKeyConfigured } from './crypto';
import { llmChat, llmConfigured } from './llm';

const API = 'https://api.spotify.com/v1';
const ACCOUNTS = 'https://accounts.spotify.com';

// playlist-read-*: playlist, user-library-read: liked songs,
// streaming + playback: Premium хэрэглэгчид апп дотор тоглуулах (Web Playback SDK)
export const SCOPES = [
  'user-read-private', 'user-read-email', 'playlist-read-private', 'playlist-read-collaborative',
  'user-library-read', 'streaming', 'user-read-playback-state', 'user-modify-playback-state',
];

export const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
// Spotify "localhost"-ийг зөвшөөрдөггүй: локалд http://127.0.0.1:3000 ашиглана
export const redirectUri = () => `${appUrl()}/api/spotify/callback`;
export const spotifyConfigured = () => Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET && tokenKeyConfigured());

export class SpotifyError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}

const basicAuth = () => 'Basic ' + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');

export function authorizeUrl(state: string) {
  const q = new URLSearchParams({
    response_type: 'code', client_id: process.env.SPOTIFY_CLIENT_ID!, scope: SCOPES.join(' '),
    redirect_uri: redirectUri(), state, show_dialog: 'false',
  });
  return `${ACCOUNTS}/authorize?${q}`;
}

type TokenRes = { access_token: string; refresh_token?: string; expires_in: number; scope?: string };

async function tokenRequest(body: Record<string, string>): Promise<TokenRes> {
  const res = await fetch(`${ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: { Authorization: basicAuth(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new SpotifyError(res.status, `token: ${await res.text()}`);
  return res.json();
}

export const exchangeCode = (code: string) => tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() });

/** Spotify Web API дуудлага. 429 үед Retry-After хүлээгээд нэг удаа давтана. */
export async function api<T>(token: string, path: string, init?: RequestInit, retry = true): Promise<T> {
  const res = await fetch(path.startsWith('http') ? path : API + path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...init?.headers },
    signal: AbortSignal.timeout(15_000),
  });
  if (res.status === 429 && retry) {
    const wait = Math.min(10, Number(res.headers.get('retry-after') ?? 2));
    await new Promise(r => setTimeout(r, wait * 1000));
    return api<T>(token, path, init, false);
  }
  if (!res.ok) throw new SpotifyError(res.status, `${path}: ${(await res.text()).slice(0, 200)}`);
  return (res.status === 204 ? null : await res.json()) as T;
}

export async function saveConnection(userId: string, t: TokenRes, me: { id: string; display_name?: string | null }) {
  const db = createServiceClient();
  const { error } = await db.from('spotify_connections').upsert({
    user_id: userId, spotify_user_id: me.id, display_name: me.display_name || me.id,
    access_token: encrypt(t.access_token), refresh_token: encrypt(t.refresh_token!),
    expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(), scope: t.scope ?? '',
  });
  if (error) throw error;
  await db.from('profiles').update({ spotify_connected: true }).eq('id', userId);
}

export async function removeConnection(userId: string) {
  const db = createServiceClient();
  await db.from('spotify_tracks').delete().eq('user_id', userId);
  await db.from('spotify_connections').delete().eq('user_id', userId);
  await db.from('profiles').update({ spotify_connected: false }).eq('id', userId);
}

/** Хүчинтэй access token. Хугацаа дуусах гэж байвал refresh хийнэ. Холбоогүй бол null. */
export async function getAccessToken(userId: string): Promise<{ token: string; expiresAt: number; spotifyUserId: string } | null> {
  const db = createServiceClient();
  const { data: c } = await db.from('spotify_connections').select('*').eq('user_id', userId).maybeSingle();
  if (!c) return null;
  const exp = new Date(c.expires_at).getTime();
  if (exp - Date.now() > 60_000) return { token: decrypt(c.access_token), expiresAt: exp, spotifyUserId: c.spotify_user_id };
  try {
    const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: decrypt(c.refresh_token) });
    const expiresAt = Date.now() + t.expires_in * 1000;
    await db.from('spotify_connections').update({
      access_token: encrypt(t.access_token), expires_at: new Date(expiresAt).toISOString(),
      // Spotify заримдаа шинэ refresh token буцаадаг
      ...(t.refresh_token ? { refresh_token: encrypt(t.refresh_token) } : {}),
    }).eq('user_id', userId);
    return { token: t.access_token, expiresAt, spotifyUserId: c.spotify_user_id };
  } catch (e) {
    // Хэрэглэгч Spotify дээр зөвшөөрлөө цуцалсан → холболтыг устгана
    if (e instanceof SpotifyError && e.status === 400) await removeConnection(userId);
    throw e;
  }
}

type Page<T> = { items: T[]; next: string | null };
async function collect<T>(token: string, path: string, maxPages: number) {
  const out: T[] = [];
  let url: string | null = path;
  for (let i = 0; url && i < maxPages; i++) {
    const page: Page<T> = await api<Page<T>>(token, url);
    out.push(...page.items);
    url = page.next;
  }
  return out;
}

const LIMITS = { likedPages: 4, playlists: 20, playlistPages: 2, maxTracks: 600, batch: 40 };

/** Liked songs + өөрийн playlist-үүдийг татаж, mood-оор ангилж хадгална */
export async function syncLibrary(userId: string) {
  const auth = await getAccessToken(userId);
  if (!auth) throw new SpotifyError(401, 'not connected');
  const { token, spotifyUserId } = auth;
  const tracks = new Map<string, SpotifyTrack>();
  const add = (t: SpotifyTrack | null) => { if (t && tracks.size < LIMITS.maxTracks) tracks.set(t.id, t); };

  // 1) Liked songs
  (await collect<{ track: unknown }>(token, '/me/tracks?limit=50', LIMITS.likedPages)).forEach(s => add(toTrack(s.track)));

  // 2) Өөрийн (эсвэл хамтарсан) playlist. Development Mode-д бусдын playlist-ийн дууг уншиж болохгүй.
  const playlists = (await collect<{ id: string; collaborative?: boolean; owner?: { id: string } }>(token, '/me/playlists?limit=50', 2))
    .filter(p => p.owner?.id === spotifyUserId || p.collaborative)
    .slice(0, LIMITS.playlists);
  for (const p of playlists) {
    if (tracks.size >= LIMITS.maxTracks) break;
    try {
      (await collect<unknown>(token, `/playlists/${p.id}/items?limit=50&additional_types=track`, LIMITS.playlistPages)).forEach(e => add(playlistEntryTrack(e)));
    } catch (e) {
      if (!(e instanceof SpotifyError && e.status === 403)) throw e; // хандах эрхгүй playlist-ийг алгасна
    }
  }

  const list = [...tracks.values()];
  const moods = await classify(list);
  const db = createServiceClient();
  await db.from('spotify_tracks').delete().eq('user_id', userId);
  for (let i = 0; i < list.length; i += 500) {
    const { error } = await db.from('spotify_tracks').insert(list.slice(i, i + 500).map(t => ({
      user_id: userId, track_id: t.id, name: t.name, artists: t.artists, image: t.image, uri: t.uri, duration_ms: t.duration_ms, moods: moods.get(t.id) ?? ['neutral'],
    })));
    if (error) throw error;
  }
  await db.from('spotify_connections').update({ synced_at: new Date().toISOString() }).eq('user_id', userId);
  return { tracks: list.length, playlists: playlists.length };
}

/** Cache-д байхгүй дуунуудыг LLM-ээр (40-өөр нь багцлан) ангилж, cache-д нэмнэ */
export async function classify(list: Pick<SpotifyTrack, 'id' | 'name' | 'artists'>[]) {
  const db = createServiceClient();
  const result = new Map<string, MoodId[]>();
  for (let i = 0; i < list.length; i += 200) {
    const { data } = await db.from('track_moods').select('track_id,moods').in('track_id', list.slice(i, i + 200).map(t => t.id));
    data?.forEach(r => result.set(r.track_id, r.moods as MoodId[]));
  }
  const todo = list.filter(t => !result.has(t.id));
  const rows: { track_id: string; moods: MoodId[]; source: 'llm' | 'heuristic' }[] = [];
  for (let i = 0; i < todo.length; i += LIMITS.batch) {
    const batch = todo.slice(i, i + LIMITS.batch);
    const parsed = llmConfigured()
      ? parseClassification((await llmChat(classifyPrompt(batch), { temperature: 0, maxTokens: 2500, timeoutMs: 40_000 }))?.text ?? '', batch.length)
      : new Map<number, MoodId[]>();
    batch.forEach((t, j) => {
      const m = parsed.get(j);
      rows.push({ track_id: t.id, moods: m ?? heuristicMoods(t), source: m ? 'llm' : 'heuristic' });
      result.set(t.id, m ?? heuristicMoods(t));
    });
  }
  // Түлхүүр үгээр ангилсныг cache-д хадгалахгүй: дараа нь LLM тохируулахад дахин ангилагдана
  const llmRows = rows.filter(r => r.source === 'llm');
  if (llmRows.length) await db.from('track_moods').upsert(llmRows);
  return result;
}
