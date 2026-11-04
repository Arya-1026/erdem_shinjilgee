import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { RECS } from '@/lib/data';
import { interleave, MN_IDS, pickGenres, pickMongolian } from '@/lib/mn-songs';
import { AMBIENT_FALLBACK, parseSuggestions, suggestPrompt, topArtists, type MusicKind, type Suggestion } from '@/lib/music-suggest';
import type { MoodId, SongRec } from '@/lib/types';
import { llmChat, llmConfigured } from './llm';
import { findSong, getYouTubeToken, QuotaExceeded, youtubeSearchConfigured } from './youtube';

const COLS = 'video_id,title,artist,thumbnail,duration_s,reason';
const FRESH_MS = 7 * 864e5, MIN_REFRESH_MS = 60_000, COUNT = 6;
const today = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); // Улаанбаатарын цагаар

/**
 * Тухайн хэрэглэгч, тухайн mood-д зориулсан дуунууд. 7 хоног хадгалагдана.
 * Хэрэглэгчийн сан (YouTube/Spotify), хобби, 👍/👎-аас хамаарч хүн бүрт өөр байна.
 */
export async function songRecs(supabase: SupabaseClient, userId: string, mood: MoodId, refresh: boolean, kind: MusicKind = 'song') {
  const { data: existing } = await supabase.from('song_recs').select(`${COLS},created_at`).eq('user_id', userId).eq('mood', mood).eq('kind', kind).order('position');
  const newest = Math.max(0, ...(existing ?? []).map(r => new Date(r.created_at).getTime()));
  const age = Date.now() - newest;
  // Монгол дуугүй хуучин жагсаалтыг 7 хоног хүлээлгүй дахин үүсгэнэ
  const noMongolian = kind === 'song' && !existing?.some(r => MN_IDS.has(r.video_id));
  if (existing?.length && (!refresh && !noMongolian ? age < FRESH_MS : age < MIN_REFRESH_MS)) return { recs: existing as SongRec[], cached: true };

  const userToken = await getYouTubeToken(userId).catch(() => null);
  if (!youtubeSearchConfigured() && !userToken) return { recs: [] as SongRec[], cached: false, reason: 'not-configured' as const };

  // ---- Хэрэглэгчийн амт ----
  const [profile, yt, sp, fb, allRecs, todayEntry] = await Promise.all([
    supabase.from('profiles').select('hobbies').eq('id', userId).single(),
    supabase.from('youtube_tracks').select('video_id,title,artist,moods').limit(1000),
    supabase.from('spotify_tracks').select('name,artists,moods').limit(1000),
    supabase.from('rec_feedback').select('rec_id,value').like('rec_id', 'yt:%'),
    supabase.from('song_recs').select('video_id,title,artist'),
    supabase.from('mood_entries').select('tags,intensity').eq('entry_date', today()).order('entry_time', { ascending: false }).limit(1).maybeSingle(),
  ]);
  const library = [
    ...(yt.data ?? []).map(t => ({ id: t.video_id as string | null, title: t.title, artist: t.artist, moods: t.moods as string[] })),
    ...(sp.data ?? []).map(t => ({ id: null, title: t.name, artist: t.artists, moods: t.moods as string[] })),
  ];
  const label = (id: string) => {
    const t = library.find(x => x.id === id) ?? allRecs.data?.find(x => x.video_id === id);
    return t ? `${t.artist} - ${t.title}` : null;
  };
  const vote = (v: number) => (fb.data ?? []).filter(f => f.value === v).map(f => f.rec_id.slice(3));
  const disliked = new Set(vote(-1));
  const known = new Set([...library.map(t => t.id), ...(existing ?? []).map(r => r.video_id)].filter(Boolean));

  const hobbies: string[] = profile.data?.hobbies ?? [], genres = pickGenres(hobbies);
  const taste = {
    mood, kind, count: COUNT + 4, genres,
    today: todayEntry.data ? { tags: todayEntry.data.tags as string[], intensity: todayEntry.data.intensity as number } : null,
    hobbies,
    // Тухайн mood-д тохирох уран бүтээлчдийг эхэнд нь
    artists: topArtists([...library.filter(t => t.moods.includes(mood)), ...library].map(t => t.artist)),
    liked: vote(1).map(label).filter((x): x is string => Boolean(x)).slice(0, 10),
    disliked: [...disliked].map(label).filter((x): x is string => Boolean(x)).slice(0, 10),
    exclude: [...(existing ?? []), ...library.filter(t => t.moods.includes(mood))].slice(0, 40).map(t => `${t.artist} - ${t.title}`),
  };

  // ---- Санал → YouTube бичлэг ----
  let ideas: Suggestion[] = [];
  if (llmConfigured()) ideas = parseSuggestions((await llmChat(suggestPrompt(taste), { temperature: 0.9, maxTokens: 1500, timeoutMs: 30_000 }))?.text ?? '', taste.count);
  // LLM байхгүй бол апп-ын ерөнхий дуунууд (хүн бүрт адил)
  if (!ideas.length) ideas = kind === 'ambient'
    ? AMBIENT_FALLBACK[mood].map(a => ({ ...a, why: '' }))
    : RECS.filter(r => r.type === 'song' && !r.videoId && r.moods.includes(mood)).map(r => ({ title: r.title, artist: r.sub, why: '' }));

  // Дууны тал хувь нь монгол (шалгасан жагсаалтаас), үлдсэнийг нь AI-ийн саналаас
  const mongolian = kind === 'song' ? pickMongolian(mood, new Set([...disliked, ...library.flatMap(t => t.id ?? [])]), new Set((existing ?? []).map(r => r.video_id)), COUNT, genres) : [];
  const room = COUNT - Math.min(mongolian.length, COUNT / 2);

  const found: SongRec[] = [];
  for (const s of ideas) {
    if (found.length >= room) break;
    let v;
    try { v = await findSong(s.artist, s.title, userToken, { ambient: kind === 'ambient' }); } catch (e) { if (e instanceof QuotaExceeded) break; console.error('[music] search', e); continue; }
    if (!v || disliked.has(v.video_id) || known.has(v.video_id) || MN_IDS.has(v.video_id) || found.some(r => r.video_id === v.video_id)) continue;
    found.push({ video_id: v.video_id, title: s.title, artist: s.artist, thumbnail: v.thumbnail, duration_s: v.duration_s, reason: s.why });
  }

  // Хайлт бүтэхгүй (квот дууссан) үед монгол дуунууд COUNT хүртэл нөхнө
  const recs = interleave(mongolian.slice(0, COUNT - found.length), found);
  if (!recs.length) return { recs: (existing ?? []) as SongRec[], cached: true, reason: 'none-found' as const };
  await supabase.from('song_recs').delete().eq('user_id', userId).eq('mood', mood).eq('kind', kind);
  await supabase.from('song_recs').insert(recs.map((r, i) => ({ ...r, mood, kind, position: i })));
  return { recs, cached: false };
}
