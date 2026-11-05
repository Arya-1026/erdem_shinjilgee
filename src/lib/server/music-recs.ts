import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ageGroup, findArtist, hardAllowed, MN_ARTISTS, rankArtists, type AgeGroup } from '@/lib/artists';
import { interleave, pickGenres, pickMongolian, type Genre } from '@/lib/mn-songs';
import { AMBIENT_FALLBACK, balanceByGoal, goalLabel, MOOD_GOALS, parsePicks, parseSuggestions, suggestPrompt, topArtists, type MusicKind, type Suggestion } from '@/lib/music-suggest';
import type { MoodId, SongRec } from '@/lib/types';
import { songKey } from '@/lib/spotify-parse';
import { llmConfigured, llmSmart } from './llm';
import { classify, spotifyConfigured } from './spotify';
import { artistSongs, findSong, QuotaExceeded, type FoundSong } from './spotify-search';

const COLS = 'video_id,title,artist,thumbnail,duration_s,reason';
const FRESH_MS = 7 * 864e5, MIN_REFRESH_MS = 60_000, COUNT = 8, HALF = COUNT / 2;
/** Нэг удаад шинээр хайх уран бүтээлч. Хайсан нь 30 хоног cache-д байна. */
const NEW_SEARCHES = 5, CATALOG_ARTISTS = 4, FAV_ARTISTS = 3, POOL_MAX = 24;
/** Spotify track id 22 тэмдэгт. Хуучин YouTube-ийн бичлэгтэй жагсаалтыг дахин үүсгэнэ. */
const isSpotifyId = (id: string) => id.length === 22;
const today = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); // Улаанбаатарын цагаар

/** fit: mood-д таарах нь тодорхой. Монгол дууны нэрээр LLM ангилал найдваргүй тул таараагүй нь AI-ийн сонголтод үлдэж, автоматаар нөхөгдөхгүй. */
type Candidate = SongRec & { fav: boolean; fit: boolean; goal?: string; intl?: boolean };
const shuffled = <T,>(a: T[]) => a.map(x => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map(p => p[1]);

/**
 * AI-д сонгуулах шалгасан дуунууд: дуртай дуучид, насанд/төрөлд тохирох монгол дуучдын Spotify-д байгаа дуу
 * (LLM mood-оор ангилсан) + гараар шалгасан жагсаалт. Бүгд бодит дуу тул LLM нэр зохиох боломжгүй.
 */
async function verifiedPool(p: { mood: MoodId; favs: string[]; age: AgeGroup | null; genres: Genre[]; disliked: Set<string>; seen: Set<string> }) {
  const hardOk = hardAllowed(p.mood);
  const genres = hardOk ? p.genres : p.genres.filter(g => g !== 'Метал');
  const catalog = rankArtists(MN_ARTISTS.filter(a => hardOk || !a.hard), p.age, genres, Math.random).slice(0, CATALOG_ARTISTS);
  const favs = p.favs.slice(0, FAV_ARTISTS).filter(n => hardOk || !findArtist(n)?.hard);
  const budget = { left: NEW_SEARCHES };

  const songs = new Map<string, { v: FoundSong; fav: boolean; intl: boolean }>();
  const collect = async (name: string, aka: string[], intl: boolean, fav: boolean) => {
    try {
      for (const v of await artistSongs(name, aka, budget)) if (!songs.has(v.video_id)) songs.set(v.video_id, { v, fav, intl });
    } catch (e) { if (!(e instanceof QuotaExceeded)) console.error('[music] artist', e); }
  };
  for (const name of favs) {
    const known = findArtist(name);
    await collect(name, known?.aka ?? [], Boolean(known) && !MN_ARTISTS.includes(known!), true);
  }
  for (const a of catalog) await collect(a.name, a.aka ?? [], false, false);

  const moods = await classify([...songs.values()].map(({ v }) => ({ id: v.video_id, name: v.title, artists: v.channel })));
  const found: Candidate[] = [...songs.values()].flatMap(({ v, fav, intl }) => {
    if (p.disliked.has(v.video_id)) return [];
    if (!hardOk && (findArtist(v.channel)?.hard || /\bmetal\b/i.test(v.title))) return [];
    return [{ video_id: v.video_id, title: v.title, artist: v.channel, thumbnail: v.thumbnail, duration_s: v.duration_s, reason: fav ? 'Таны дуртай дуучин' : '', fav, intl, fit: moods.get(v.video_id)?.includes(p.mood) ?? false }];
  });
  const curated: Candidate[] = pickMongolian(p.mood, p.disliked, p.seen, 12, p.genres).map(r => ({ ...r, fav: false, fit: true }));

  // Давхардсан бичлэг, нэг дууны өөр хувилбарыг хасна. Сүүлд гарсныг хойш тавина.
  const keys = new Set<string>();
  return [...shuffled(found).sort((a, b) => Number(b.fav) - Number(a.fav) || Number(b.fit) - Number(a.fit)), ...curated]
    .filter(c => { const k = songKey(c.artist, c.title); if (keys.has(k) || keys.has(c.video_id)) return false; keys.add(k); keys.add(c.video_id); return true; })
    .sort((a, b) => Number(p.seen.has(a.video_id)) - Number(p.seen.has(b.video_id)))
    .slice(0, POOL_MAX);
}

/**
 * Тухайн хэрэглэгч, тухайн mood-д зориулсан дуунууд. 7 хоног хадгалагдана.
 * Нас, дуртай дуучид, төрөл, өөрийн сан, 👍/👎-аас хамаарч AI сонгоно: тал нь монгол (Spotify дээр байгаа дуунаас), тал нь олон улсын.
 */
export async function songRecs(supabase: SupabaseClient, userId: string, mood: MoodId, refresh: boolean, kind: MusicKind = 'song') {
  const { data: existing } = await supabase.from('song_recs').select(`${COLS},created_at`).eq('user_id', userId).eq('mood', mood).eq('kind', kind).order('position');
  const newest = Math.max(0, ...(existing ?? []).map(r => new Date(r.created_at).getTime()));
  const age = Date.now() - newest;
  if (existing?.length && existing.every(r => isSpotifyId(r.video_id)) && (!refresh ? age < FRESH_MS : age < MIN_REFRESH_MS)) return { recs: existing as SongRec[], cached: true };

  if (!spotifyConfigured()) return { recs: [] as SongRec[], cached: false, reason: 'not-configured' as const };

  // ---- Хэрэглэгчийн амт ----
  const [profile, sp, fb, allRecs, liked, todayEntry] = await Promise.all([
    supabase.from('profiles').select('hobbies,birth_year,fav_artists').eq('id', userId).single(),
    supabase.from('spotify_tracks').select('track_id,name,artists,moods').limit(1000),
    supabase.from('rec_feedback').select('rec_id,value').like('rec_id', 'sp:%'),
    supabase.from('song_recs').select('video_id,title,artist'),
    supabase.from('liked_songs').select('video_id,title,artist').limit(30),
    supabase.from('mood_entries').select('tags,intensity').eq('entry_date', today()).order('entry_time', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const library = (sp.data ?? []).map(t => ({ id: t.track_id as string, title: t.name as string, artist: t.artists as string, moods: t.moods as string[] }));
  const label = (id: string) => {
    const t = library.find(x => x.id === id) ?? allRecs.data?.find(x => x.video_id === id) ?? liked.data?.find(x => x.video_id === id);
    return t ? `${t.artist} - ${t.title}` : null;
  };
  const vote = (v: number) => (fb.data ?? []).filter(f => f.value === v).map(f => f.rec_id.slice(3));
  const disliked = new Set(vote(-1));
  const seen = new Set((existing ?? []).map(r => r.video_id as string));
  const known = new Set([...library.map(t => t.id), ...seen].filter(Boolean));

  const hobbies: string[] = profile.data?.hobbies ?? [], genres = pickGenres(hobbies);
  const favs: string[] = profile.data?.fav_artists ?? [], ageG = ageGroup(profile.data?.birth_year);
  const pool = kind === 'song' ? await verifiedPool({ mood, favs, age: ageG, genres, disliked, seen }) : [];

  const taste = {
    mood, kind, count: COUNT + 2, genres, age: ageG, favArtists: favs,
    pool: pool.map(c => ({ title: c.title, artist: c.artist, fav: c.fav, goal: c.goal })), pick: HALF,
    today: todayEntry.data ? { tags: todayEntry.data.tags as string[], intensity: todayEntry.data.intensity as number } : null,
    hobbies,
    // Тухайн mood-д тохирох уран бүтээлчдийг эхэнд нь
    artists: topArtists([...library.filter(t => t.moods.includes(mood)), ...library].map(t => t.artist)),
    liked: [...(liked.data ?? []).map(t => `${t.artist} - ${t.title}`), ...vote(1).map(label).filter((x): x is string => Boolean(x))].slice(0, 10),
    disliked: [...disliked].map(label).filter((x): x is string => Boolean(x)).slice(0, 10),
    exclude: [...(existing ?? []), ...library.filter(t => t.moods.includes(mood))].slice(0, 40).map(t => `${t.artist} - ${t.title}`),
  };

  // ---- AI: шалгасан дуунаас сонгож, олон улсын дуу санал болгоно ----
  const reply = llmConfigured() ? (await llmSmart(suggestPrompt(taste), { temperature: 0.8, maxTokens: 2500, timeoutMs: 30_000 }))?.text ?? '' : '';
  // Шалгасан жагсаалтыг олон улсын саналд давтсан бол хасна
  const poolArtists = new Set(pool.map(c => c.artist.toLowerCase()));
  let ideas: Suggestion[] = parseSuggestions(reply, taste.count).filter(s => !poolArtists.has(s.artist.toLowerCase()) && !/[Ѐ-ӿ]/.test(s.artist));
  if (!ideas.length && kind === 'ambient') ideas = AMBIENT_FALLBACK[mood].map(a => ({ ...a, why: '' }));

  // Дуртай дуучны дуу заавал орно, дараа нь AI-ийн сонголт, дутвал pool-ын эрэмбээр
  const picks = parsePicks(reply, pool.length);
  const why = new Map(picks.map(p => [p.i, p]));
  const goals = kind === 'song' ? MOOD_GOALS[mood] : [];
  // Шалтгаанд зорилгыг л харуулна: загварын монгол тайлбар найруулга муутай (жишээ нь орос үг холилддог)
  const tagged = (key: string | undefined, text: string) => { const l = kind === 'song' ? goalLabel(mood, key) ?? (goals.length === 1 ? goals[0].label : undefined) : undefined; return l ? [l, text].filter(Boolean).join(': ') : text; };
  const order = [...new Set([...pool.flatMap((c, i) => (c.fav && c.fit ? [i] : [])).slice(0, 2), ...picks.map(p => p.i), ...pool.flatMap((c, i) => (c.fit ? [i] : []))])];
  // Дуртай гадаад дуучны дуу монгол дууны хагасыг эзлэхгүй: дээд тал нь 2
  let intl = 0;
  // Нэг дуучны дуу жагсаалтыг дүүргэхгүй: дээд тал нь 2
  const perArtist = new Map<string, number>();
  const varied = (i: number) => { const n = perArtist.get(pool[i].artist) ?? 0; perArtist.set(pool[i].artist, n + 1); return n < 2; };
  const chosen = balanceByGoal(order.filter(i => varied(i) && (!pool[i].intl || intl++ < 2)).map(i => {
    const c = pool[i], g = why.get(i)?.goal ?? c.goal ?? (goals.length === 1 ? goals[0].key : undefined);
    return { video_id: c.video_id, title: c.title, artist: c.artist, thumbnail: c.thumbnail, duration_s: c.duration_s, reason: tagged(g, c.reason), goal: g };
  }), goals, COUNT);

  const room = COUNT - Math.min(chosen.length, HALF);
  const found: SongRec[] = [];
  const taken = new Set(chosen.map(c => c.video_id));
  for (const s of balanceByGoal(ideas, goals, ideas.length)) {
    if (found.length >= room) break;
    let v;
    try { v = await findSong(s.artist, s.title, { ambient: kind === 'ambient' }); } catch (e) { if (e instanceof QuotaExceeded) break; console.error('[music] search', e); continue; }
    if (!v || disliked.has(v.video_id) || known.has(v.video_id) || taken.has(v.video_id) || found.some(r => r.video_id === v.video_id)) continue;
    found.push({ video_id: v.video_id, title: s.title, artist: s.artist, thumbnail: v.thumbnail, duration_s: v.duration_s, reason: kind === 'song' ? tagged(s.goal, '') : s.why });
  }

  // Хайлт бүтэхгүй (квот дууссан) үед шалгасан дуунууд COUNT хүртэл нөхнө
  const recs = interleave(chosen.slice(0, COUNT - found.length), found);
  if (!recs.length) return { recs: (existing ?? []) as SongRec[], cached: true, reason: 'none-found' as const };
  await supabase.from('song_recs').delete().eq('user_id', userId).eq('mood', mood).eq('kind', kind);
  await supabase.from('song_recs').insert(recs.map((r, i) => ({ video_id: r.video_id, title: r.title, artist: r.artist, thumbnail: r.thumbnail, duration_s: r.duration_s, reason: r.reason, mood, kind, position: i })));
  return { recs, cached: false };
}
