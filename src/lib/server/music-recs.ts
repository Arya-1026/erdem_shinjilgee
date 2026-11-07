import 'server-only';
import { matchesLocale, type Locale } from '@/lib/i18n';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ageGroup, findArtist, hardAllowed, INTL_ARTISTS, MN_ARTISTS, rankArtists, type AgeGroup, type Artist } from '@/lib/artists';
import { interleave, MN_SONGS, pickMongolian } from '@/lib/mn-songs';
import { AMBIENT_FALLBACK, balanceByGoal, goalLabel, MOOD_GOALS, parsePicks, parseSuggestions, suggestPrompt, topArtists, type MusicKind, type Suggestion, type Taste } from '@/lib/music-suggest';
import { GENRE_QUERY, tasteGenres, tasteMatch, tasteRank, tasteReason, type TasteGenre } from '@/lib/music-taste';
import type { MoodId, SongRec } from '@/lib/types';
import { songKey } from '@/lib/spotify-parse';
import { llmConfigured, llmSmart } from './llm';
import { classify, spotifyConfigured } from './spotify';
import { artistSongs, findSong, genreSongs, QuotaExceeded, type FoundSong } from './spotify-search';

const COLS = 'video_id,title,artist,thumbnail,duration_s,reason';
const FRESH_MS = 7 * 864e5, MIN_REFRESH_MS = 60_000, COUNT = 8, HALF = COUNT / 2;
/** Нэг хүсэлтэд шинээр хайх уран бүтээлч, төрлийн тоо. Хайсан нь 30 хоног cache-д байж бүх хэрэглэгч хуваалцана. */
const NEW_SEARCHES = 5, CATALOG_ARTISTS = 4, CATALOG_INTL = 2, FAV_ARTISTS = 3, GENRE_POOLS = 4;
/** Хэсэг (монгол, олон улсын) бүрээс ангилах, AI-д үзүүлэх дээд тоо */
const CLASSIFY_MAX = 30, POOL_MAX = 20;
/** Spotify track id 22 тэмдэгт. Хуучин YouTube-ийн бичлэгтэй жагсаалтыг дахин үүсгэнэ. */
const isSpotifyId = (id: string) => id.length === 22;
/** Үүнээс өмнөх аяны жагсаалтад нэр нь таарахгүй дуу орсон байж болох тул дахин үүсгэнэ */
const AMBIENT_CHECKED_SINCE = Date.parse('2026-11-07T10:00:00Z');
const today = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); // Улаанбаатарын цагаар

/** fit: mood-д таарах нь тодорхой. Монгол дууны нэрээр LLM ангилал найдваргүй тул таараагүй нь AI-ийн сонголтод үлдэж, автоматаар нөхөгдөхгүй. */
type Candidate = SongRec & { fav: boolean; fit: boolean; intl: boolean; rank: number; moods: MoodId[] };
type Source = { v: FoundSong; fav: boolean; intl: boolean; rank: number; reason: string };
const shuffled = <T,>(a: T[]) => a.map(x => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map(p => p[1]);

/**
 * AI-д сонгуулах шалгасан дуунууд: дуртай дуучид, төрлийн нийтлэг сан, насанд/төрөлд тохирох дуучдын дуу
 * (LLM mood-оор ангилсан) + гараар шалгасан жагсаалт. Бүгд бодит дуу тул LLM нэр зохиох боломжгүй.
 * quota: Spotify-ийн квот дууссан тул сан дутуу байж магадгүй.
 */
async function verifiedPool(p: { mood: MoodId; favs: string[]; age: AgeGroup | null; taste: TasteGenre[]; disliked: Set<string>; seen: Set<string>; library: Set<string> }) {
  const hardOk = hardAllowed(p.mood);
  const taste = p.taste.filter(t => hardOk || t.genre !== 'Метал');
  const names = taste.map(t => t.genre);
  const pickArtists = (list: Artist[], n: number) => rankArtists(list.filter(a => hardOk || !a.hard), p.age, names, Math.random).slice(0, n);
  const budget = { left: NEW_SEARCHES, quota: false };

  const songs = new Map<string, Source>();
  const collect = async (load: () => Promise<FoundSong[]>, meta: Omit<Source, 'v'>) => {
    try {
      for (const v of await load()) if (!songs.has(v.video_id)) songs.set(v.video_id, { v, ...meta });
    } catch (e) {
      if (e instanceof QuotaExceeded) { budget.quota = true; budget.left = 0; } else console.error('[music] pool', e);
    }
  };
  const collectArtist = (a: Artist, intl: boolean) => {
    const t = tasteMatch(a.genres, taste);
    return collect(() => artistSongs(a.name, a.aka ?? [], budget), { fav: false, intl, rank: tasteRank(t), reason: tasteReason(t) });
  };

  for (const name of p.favs.slice(0, FAV_ARTISTS).filter(n => hardOk || !findArtist(n)?.hard)) {
    const known = findArtist(name);
    await collect(() => artistSongs(name, known?.aka ?? [], budget), { fav: true, intl: Boolean(known) && !MN_ARTISTS.includes(known!), rank: 0, reason: 'Таны дуртай дуучин' });
  }
  // Сонгосон төрөл түрүүлж, амт тодорхойгүй бол поп. Хайлт 30 хоног хадгалагдах тул хэрэглэгчид өсөхөд Spotify-ийн дуудлага нэмэгдэхгүй.
  const pools: TasteGenre[] = [...shuffled(taste.filter(t => !t.hobby)), ...taste.filter(t => t.hobby)].slice(0, GENRE_POOLS);
  for (const t of pools.length ? pools : [{ genre: 'Поп' as const }]) {
    const own = pools.length ? t : undefined;
    await collect(() => genreSongs(GENRE_QUERY[t.genre], budget), { fav: false, intl: true, rank: tasteRank(own), reason: tasteReason(own) });
  }
  for (const a of pickArtists(MN_ARTISTS, CATALOG_ARTISTS)) await collectArtist(a, false);
  // Төрлийн хайлт хангалтгүй (genre шүүлтэд дуу цөөн) үед олон улсын дуучдаар нөхнө
  if ([...songs.values()].filter(s => s.intl).length < COUNT) for (const a of pickArtists(INTL_ARTISTS, CATALOG_INTL)) await collectArtist(a, true);

  const allowed = [...songs.values()].filter(({ v, fav, intl }) => {
    if (p.disliked.has(v.video_id)) return false;
    if (!hardOk && (findArtist(v.channel)?.hard || /\bmetal\b/i.test(v.title))) return false;
    return fav || !intl || !p.library.has(v.video_id); // Шинэ олон улсын дуу: сандаа байгааг давтахгүй
  });
  const ranked = shuffled(allowed).sort((a, b) => a.rank - b.rank);
  const capped = [...ranked.filter(s => !s.intl).slice(0, CLASSIFY_MAX), ...ranked.filter(s => s.intl).slice(0, CLASSIFY_MAX)];
  const moods = await classify(capped.map(({ v }) => ({ id: v.video_id, name: v.title, artists: v.channel })));
  const found: Candidate[] = capped.map(({ v, fav, intl, rank, reason }) => {
    const m = moods.get(v.video_id) ?? [];
    return { video_id: v.video_id, title: v.title, artist: v.channel, thumbnail: v.thumbnail, duration_s: v.duration_s, reason, fav, intl, rank, moods: m, fit: m.includes(p.mood) };
  });
  const curated: Candidate[] = pickMongolian(p.mood, p.disliked, p.seen, 12, taste.filter(t => !t.hobby).map(t => t.genre)).map(r => {
    const s = MN_SONGS.find(x => x.id === r.video_id)!, t = tasteMatch(s.genres, taste);
    return { ...r, reason: tasteReason(t) || r.reason, fav: false, fit: true, intl: false, rank: tasteRank(t), moods: s.moods };
  });

  // Давхардсан бичлэг, нэг дууны өөр хувилбарыг хасна. Сүүлд гарсныг хойш тавина.
  const keys = new Set<string>();
  const list = [...found, ...curated]
    .sort((a, b) => a.rank - b.rank || Number(b.fit) - Number(a.fit))
    .filter(c => { const k = songKey(c.artist, c.title); if (keys.has(k) || keys.has(c.video_id)) return false; keys.add(k); keys.add(c.video_id); return true; })
    .sort((a, b) => Number(p.seen.has(a.video_id)) - Number(p.seen.has(b.video_id)));
  const pool = [...list.filter(c => !c.intl).slice(0, POOL_MAX), ...list.filter(c => c.intl).slice(0, POOL_MAX)];
  // Cache-ээс хангалттай дуу олдсон бол квот дууссан ч бүрэн жагсаалт болно
  const thin = pool.filter(c => c.intl).length < HALF;
  return { pool, quota: budget.quota && thin, partial: budget.left <= 0 && thin };
}

/** Дуу: AI зөвхөн шалгасан сангаас сонгоно. Ажиллахгүй бол mood-д таарсан дуунууд эрэмбээрээ сонгогдоно. */
async function pickSongs(base: Taste, p: Omit<Parameters<typeof verifiedPool>[0], 'mood' | 'age'> & { age: AgeGroup | null }) {
  const { pool, quota, partial } = await verifiedPool({ ...p, mood: base.mood });
  const goals = MOOD_GOALS[base.mood];
  // Квот дууссан үеийн жагсаалт хадгалагдахгүй тул AI-г дэмий дуудахгүй
  const prompt = suggestPrompt({ ...base, pool: pool.map(c => ({ title: c.title, artist: c.artist, fav: c.fav, intl: c.intl, moods: c.moods })) });
  const reply = !quota && llmConfigured() ? (await llmSmart(prompt, { temperature: 0.8, maxTokens: 2500, timeoutMs: 30_000 }))?.text ?? '' : '';
  const picks = parsePicks(reply, pool.length);
  const why = new Map(picks.map(x => [x.i, x]));
  // Дуртай дуучны дуу заавал орно, дараа нь AI-ийн сонголт эрэмбээрээ, дутвал mood-д таарсан дуунууд
  const aiPicks = picks.map(x => x.i).sort((a, b) => pool[a].rank - pool[b].rank);
  const order = [...new Set([...pool.flatMap((c, i) => (c.fav && c.fit ? [i] : [])).slice(0, 2), ...aiPicks, ...pool.flatMap((c, i) => (c.fit ? [i] : []))])];
  // Нэг дуучны дуу жагсаалтыг дүүргэхгүй: дээд тал нь 2
  const perArtist = new Map<string, number>();
  const varied = (i: number) => { const n = perArtist.get(pool[i].artist) ?? 0; perArtist.set(pool[i].artist, n + 1); return n < 2; };
  const toRec = (i: number) => {
    const c = pool[i], goal = why.get(i)?.goal ?? (goals.length === 1 ? goals[0].key : undefined);
    // Шалтгаанд зорилгыг л харуулна: загварын монгол тайлбар найруулга муутай (жишээ нь орос үг холилддог)
    const label = goalLabel(base.mood, goal) ?? (goals.length === 1 ? goals[0].label : undefined);
    return { video_id: c.video_id, title: c.title, artist: c.artist, thumbnail: c.thumbnail, duration_s: c.duration_s, reason: label ? [label, c.reason].filter(Boolean).join(': ') : c.reason, goal };
  };
  const section = (intl: boolean) => balanceByGoal(order.filter(i => pool[i].intl === intl && varied(i)).map(toRec), goals, COUNT);
  const mn = section(false), foreign = section(true);
  // Тал талаас нь, аль нэг нь дутвал нөгөө нь нөхнө
  const foreignCount = Math.min(foreign.length, COUNT - Math.min(mn.length, HALF));
  const recs: SongRec[] = interleave(mn.slice(0, COUNT - foreignCount), foreign.slice(0, foreignCount));
  return { recs, quota, partial };
}

/** Ая: AI инструменталь бүтээл санал болгож, Spotify дээр байгаа эсэхийг шалгана */
async function pickAmbient(base: Taste, skip: (id: string) => boolean) {
  const reply = llmConfigured() ? (await llmSmart(suggestPrompt(base), { temperature: 0.8, maxTokens: 2500, timeoutMs: 30_000 }))?.text ?? '' : '';
  let ideas: Suggestion[] = parseSuggestions(reply, base.count).filter(s => !/[Ѐ-ӿ]/.test(s.artist));
  if (!ideas.length) ideas = AMBIENT_FALLBACK[base.mood].map(a => ({ ...a, why: '' }));
  const recs: SongRec[] = [];
  let quota = false;
  for (const s of ideas) {
    if (recs.length >= COUNT) break;
    let v;
    try { v = await findSong(s.artist, s.title, { ambient: true }); } catch (e) { if (e instanceof QuotaExceeded) { quota = true; break; } console.error('[music] search', e); continue; }
    if (!v || skip(v.video_id) || recs.some(r => r.video_id === v.video_id)) continue;
    // Тоглох дууны жинхэнэ нэрийг харуулна
    recs.push({ video_id: v.video_id, title: v.title, artist: v.channel, thumbnail: v.thumbnail, duration_s: v.duration_s, reason: matchesLocale(s.why, base.locale ?? 'mn') ? s.why : '' });
  }
  return { recs, quota, partial: false };
}

/**
 * Тухайн хэрэглэгч, тухайн mood-д зориулсан дуунууд. 7 хоног хадгалагдана.
 * Нас, дуртай дуучид, төрөл, хобби, өөрийн сан, 👍/👎-аас хамаарч сонгоно: тал нь монгол, тал нь олон улсын, бүгд Spotify дээр шалгагдсан.
 * Квот дууссан үед дутуу жагсаалтыг хадгалахгүй: өмнөх жагсаалт байвал түүнийг, үгүй бол түр жагсаалт буцаана.
 */
export async function songRecs(supabase: SupabaseClient, userId: string, mood: MoodId, refresh: boolean, kind: MusicKind = 'song', locale: Locale = 'mn') {
  const { data: existing } = await supabase.from('song_recs').select(`${COLS},created_at`).eq('user_id', userId).eq('mood', mood).eq('kind', kind).order('position');
  const newest = Math.max(0, ...(existing ?? []).map(r => new Date(r.created_at).getTime()));
  const age = Date.now() - newest;
  const usable = Boolean(existing?.length) && (existing ?? []).every(r => isSpotifyId(r.video_id)) && (kind !== 'ambient' || newest >= AMBIENT_CHECKED_SINCE);
  if (usable && (!refresh ? age < FRESH_MS : age < MIN_REFRESH_MS)) return { recs: existing as SongRec[], cached: true };

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
  const libraryIds = new Set(library.map(t => t.id));

  const hobbies: string[] = profile.data?.hobbies ?? [], taste = tasteGenres(hobbies);
  const favs: string[] = profile.data?.fav_artists ?? [], ageG = ageGroup(profile.data?.birth_year);

  const base: Taste = {
    locale, mood, kind, count: COUNT + 2, genres: taste.filter(t => !t.hobby).map(t => t.genre), age: ageG, favArtists: favs,
    today: todayEntry.data ? { tags: todayEntry.data.tags as string[], intensity: todayEntry.data.intensity as number } : null,
    hobbies,
    // Тухайн mood-д тохирох уран бүтээлчдийг эхэнд нь
    artists: topArtists([...library.filter(t => t.moods.includes(mood)), ...library].map(t => t.artist)),
    liked: [...(liked.data ?? []).map(t => `${t.artist} - ${t.title}`), ...vote(1).map(label).filter((x): x is string => Boolean(x))].slice(0, 10),
    disliked: [...disliked].map(label).filter((x): x is string => Boolean(x)).slice(0, 10),
    exclude: [...(existing ?? []), ...library.filter(t => t.moods.includes(mood))].slice(0, 40).map(t => `${t.artist} - ${t.title}`),
  };

  const { recs, quota, partial } = kind === 'song'
    ? await pickSongs(base, { favs, age: ageG, taste, disliked, seen, library: libraryIds })
    : await pickAmbient(base, id => disliked.has(id) || libraryIds.has(id) || seen.has(id));

  if (quota && usable) return { recs: existing as SongRec[], cached: true, reason: 'quota' as const };
  if (!recs.length) return { recs: (existing ?? []) as SongRec[], cached: true, reason: quota ? 'quota' as const : 'none-found' as const };
  if (quota) return { recs, cached: false, reason: 'quota' as const };
  // Энэ удаад бүх эх сурвалжийг хайж амжаагүй: дараагийн хүсэлт санг нөхөөд бүрэн жагсаалт үүсгэнэ
  if (partial) return { recs, cached: false };

  await supabase.from('song_recs').delete().eq('user_id', userId).eq('mood', mood).eq('kind', kind);
  await supabase.from('song_recs').insert(recs.map((r, i) => ({ video_id: r.video_id, title: r.title, artist: r.artist, thumbnail: r.thumbnail, duration_s: r.duration_s, reason: r.reason, mood, kind, position: i })));
  return { recs, cached: false };
}
