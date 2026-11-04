import 'server-only';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { BOOKING_COLS, ENTRY_COLS, EXPERT_COLS, groupSlots, normalizeEntry, PROFILE_COLS, SPOTIFY_TRACK_COLS, toExpert } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import type { Booking, Entry, Expert, ExpertSlots, MusicConfig, Profile, SpotifyStatus, SpotifyTrackRow, YouTubeStatus } from '@/lib/types';
import { spotifyConfigured } from './spotify';
import { youtubeOAuthConfigured, youtubeSearchConfigured } from './youtube';

// Data Access Layer: session шалгах, хэрэглэгчийн өгөгдөл ачаалах цорын ганц газар.
export async function requireUser() {
  // Supabase-ийн auth.getUser() session-ий хугацааг шалгахдаа дотроо Date.now() дууддаг.
  // Cache Components + Partial Prefetching үед cookie уншигдсан ч prerender үргэлжилдэг тул
  // "unstable value Date.now()" алдаа гарч байсан. connection() нь эндээс доошхийг зөвхөн хүсэлтийн үед ажиллуулна.
  await connection();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

type Client = Awaited<ReturnType<typeof createClient>>;

/** Supabase дээр supabase/setup.sql ажиллуулаагүй (хүснэгт алга) үед шидэгдэнэ → SetupNeeded дэлгэц харуулна */
export class SetupError extends Error {
  constructor(detail: string) { super(detail); this.name = 'SetupError'; }
}
// PGRST205: хүснэгт schema cache-д алга, 42P01: хүснэгт байхгүй
const isMissingTable = (e: { code?: string; message?: string } | null) =>
  Boolean(e && (e.code === 'PGRST205' || e.code === '42P01' || /schema cache|does not exist/i.test(e.message ?? '')));
type User = Awaited<ReturnType<typeof requireUser>>['user'];

// Профайл байхгүй (жишээ нь хүснэгт үүсэхээс өмнө бүртгүүлсэн) бол үүсгэнэ.
// Үгүй бол /login ↔ /home хооронд эцэс төгсгөлгүй шилжинэ.
async function loadProfile(supabase: Client, user: User) {
  const { data, error: readError } = await supabase.from('profiles').select(PROFILE_COLS).eq('id', user.id).maybeSingle<Profile>();
  if (data) return data;
  if (isMissingTable(readError)) throw new SetupError(readError!.message);
  const meta = user.user_metadata ?? {};
  const { data: created, error } = await supabase.from('profiles')
    .insert({ id: user.id, email: user.email ?? '', name: meta.name || meta.full_name || (user.email ?? '').split('@')[0] })
    .select(PROFILE_COLS).single<Profile>();
  if (isMissingTable(error)) throw new SetupError(error!.message);
  if (error) throw new Error(`Профайл үүсгэж чадсангүй (migration ажилласан эсэхийг шалгана уу): ${error.message}`);
  return created;
}

export async function getProfile() {
  const { supabase, user } = await requireUser();
  return loadProfile(supabase, user);
}

export type AppData = {
  profile: Profile;
  entries: Entry[];
  feedback: Record<string, number>;
  watchlist: string[];
  bookings: Booking[];
  experts: Expert[];
  slots: ExpertSlots;
  isExpert: boolean;
  music: MusicConfig;
  spotify: SpotifyStatus | null;
  youtube: YouTubeStatus | null;
  /** Апп-ын зөвлөмжийн дуунуудын Spotify хувилбар: rec_id → дуу */
  recTracks: Record<string, SpotifyTrackRow>;
};

export async function getAppData(): Promise<AppData> {
  const { supabase, user } = await requireUser();
  const since = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  const profile = await loadProfile(supabase, user);
  if (!profile.hobbies.length) redirect('/onboarding');
  const [e, f, w, b, ex, sl, me, sp, rt, yt] = await Promise.all([
    supabase.from('mood_entries').select(ENTRY_COLS).gte('entry_date', since).order('entry_date').order('entry_time').returns<Entry[]>(),
    supabase.from('rec_feedback').select('rec_id,value'),
    supabase.from('watchlist').select('rec_id'),
    supabase.from('bookings').select(BOOKING_COLS).eq('user_id', user.id).order('booking_date').returns<Booking[]>(),
    supabase.from('experts').select(EXPERT_COLS).order('id'),
    supabase.from('expert_slots').select('expert_id,weekday,slot'),
    supabase.rpc('my_expert_id'),
    supabase.rpc('spotify_status'),
    supabase.from('rec_tracks').select(`rec_id,${SPOTIFY_TRACK_COLS}`),
    supabase.rpc('youtube_status'),
  ]);
  return {
    profile,
    entries: (e.data ?? []).map(normalizeEntry),
    feedback: Object.fromEntries((f.data ?? []).map(x => [x.rec_id, x.value])),
    watchlist: (w.data ?? []).map(x => x.rec_id),
    bookings: b.data ?? [],
    experts: (ex.data ?? []).map(toExpert),
    slots: groupSlots(sl.data ?? []),
    isExpert: Boolean(me.data),
    music: { spotify: spotifyConfigured(), youtube: youtubeOAuthConfigured(), discovery: youtubeSearchConfigured() },
    spotify: (sp.data as SpotifyStatus[] | null)?.[0] ?? null,
    youtube: (yt.data as YouTubeStatus[] | null)?.[0] ?? null,
    recTracks: Object.fromEntries((rt.data ?? []).map(({ rec_id, ...t }) => [rec_id, t as SpotifyTrackRow])),
  };
}
