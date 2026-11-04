'use client';

import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { lastMood } from '@/lib/analytics';
import { moodById } from '@/lib/data';
import { ENTRY_COLS, normalizeEntry } from '@/lib/db';
import { hhmm, today } from '@/lib/date';
import { applyPalette, DEFAULT_PALETTE, isPaletteId } from '@/lib/palettes';
import { createClient } from '@/lib/supabase/client';
import type { AppData } from '@/lib/server/dal';
import type { Booking, Entry, EntryDraft, Mood, MoodId, Profile } from '@/lib/types';

// Нээгдэх цонхнууд (хуучин showModal-ын оронд)
export type DialogState =
  | { kind: 'saved'; mood: MoodId }
  | { kind: 'exercise'; recId: string }
  | { kind: 'breath' }
  | { kind: 'movie'; recId: string; mood: MoodId }
  | { kind: 'book'; expertId: string }
  | null;

type AppCtx = AppData & {
  supabase: ReturnType<typeof createClient>;
  /** Хэрэглэгч сүүлд сонгосон mood (carousel/зөвлөмж) → байхгүй бол сүүлийн бүртгэл */
  activeMood: Mood;
  setLiveMood: (m: MoodId) => void;
  /** Нүүр хуудасны дэвсгэрийн өнгө (carousel дээр сонгож буй mood) */
  tint: string;
  setTint: (c: string) => void;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  addEntry: (d: EntryDraft) => Promise<Entry | null>;
  setFeedback: (recId: string, value: number) => void;
  toggleWatch: (recId: string) => Promise<boolean>;
  /** true: амжилттай, 'taken': цаг өөр хүнд дөнгөж захиалагдсан, false: алдаа */
  addBooking: (b: { expertId: string; date: string; slot: string; kind: 'video' | 'chat'; share: boolean }) => Promise<boolean | 'taken'>;
  cancelBooking: (id: string) => Promise<void>;
  bumpExercises: () => void;
  /** Хөгжмийн эх үүсвэр (YouTube, Spotify): холбох (OAuth руу шилжинэ), синк хийх, салгах */
  musicConnect: (p: MusicProvider) => void;
  musicSync: (p: MusicProvider) => Promise<void>;
  musicDisconnect: (p: MusicProvider) => Promise<void>;
  musicSyncing: MusicProvider | null;
  /** Синк, салгах бүрт нэмэгдэнэ → хэрэглэгчийн сангийн дууг дахин татна */
  libraryVersion: number;
  dialog: DialogState;
  openDialog: (d: DialogState) => void;
};

export type MusicProvider = 'spotify' | 'youtube';
const PROVIDER_NAME: Record<MusicProvider, string> = { spotify: 'Spotify', youtube: 'YouTube' };

const Ctx = createContext<AppCtx | null>(null);

// Supabase алдааг toast-оор харуулна. Алдаа гарсан бол true буцаана.
const fail = (msg: string) => (e: { message: string } | null) => { if (e) toast.error(`${msg}: ${e.message}`); return Boolean(e); };

export function useApp() {
  const c = use(Ctx);
  if (!c) throw new Error('useApp must be used within AppProvider');
  return c;
}

export function AppProvider({ initial, children }: { initial: AppData; children: React.ReactNode }) {
  const [supabase] = useState(createClient);
  const [profile, setProfile] = useState(initial.profile);
  const [entries, setEntries] = useState(initial.entries);
  const [feedback, setFb] = useState(initial.feedback);
  const [watchlist, setWatch] = useState(initial.watchlist);
  const [bookings, setBookings] = useState(initial.bookings);
  const [liveMood, setLiveMood] = useState<MoodId | null>(null);
  const [tint, setTint] = useState(moodById('neutral').color);
  const [dialog, openDialog] = useState<DialogState>(null);
  const [spotify, setSpotify] = useState(initial.spotify);
  const [youtube, setYoutube] = useState(initial.youtube);
  const [recTracks, setRecTracks] = useState(initial.recTracks);
  const [musicSyncing, setSyncing] = useState<MusicProvider | null>(null);
  const [libraryVersion, setLibraryVersion] = useState(0);

  // Хэрэглэгчийн сонгосон өнгө (өөр төхөөрөмж дээр сонгосон байж болно → localStorage-тай тааруулна)
  useEffect(() => { applyPalette(isPaletteId(profile.theme) ? profile.theme : DEFAULT_PALETTE); }, [profile.theme]);

  // API route нь Google/Spotify руу redirect хийдэг тул client navigation биш, бүтэн хуудсаар шилжинэ
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  const musicConnect = useCallback((p: MusicProvider) => { location.href = `/api/${p}/login`; }, []);

  const musicSync = useCallback(async (p: MusicProvider) => {
    const name = PROVIDER_NAME[p];
    setSyncing(p);
    const t = toast.loading(`${name}-аас дуунуудыг татаж, сэтгэл хөдлөлөөр ангилж байна…`);
    try {
      const res = await fetch(`/api/${p}/sync`, { method: 'POST' });
      const j = await res.json().catch(() => ({ error: 'sync-failed' }));
      if (!res.ok) throw new Error(j.error);
      if (p === 'spotify') {
        const [{ data: st }, { data: rt }] = await Promise.all([
          supabase.rpc('spotify_status'),
          supabase.from('rec_tracks').select('rec_id,track_id,name,artists,uri,duration_ms,image'),
        ]);
        setSpotify((st as AppData['spotify'][])?.[0] ?? null);
        setRecTracks(Object.fromEntries((rt ?? []).map(({ rec_id, ...r }) => [rec_id, r])));
        setProfile(x => ({ ...x, spotify_connected: true }));
        toast.success(`${j.tracks} дуу ${j.playlists} playlist-ээс бэлэн боллоо 🎧`, { id: t });
      } else {
        const { data: st } = await supabase.rpc('youtube_status');
        setYoutube((st as AppData['youtube'][])?.[0] ?? null);
        setProfile(x => ({ ...x, youtube_connected: true }));
        toast.success(`${j.videos} бичлэгээс ${j.songs} дуу бэлэн боллоо 🎧`, { id: t });
      }
      setLibraryVersion(v => v + 1);
    } catch (e) {
      const lost = e instanceof Error && e.message === 'not-connected';
      if (lost) { setProfile(x => ({ ...x, [`${p}_connected`]: false })); if (p === 'youtube') setYoutube(null); else setSpotify(null); }
      toast.error(lost ? `${name} холболт салсан байна. Дахин холбоно уу.` : 'Синк амжилтгүй боллоо. Дахин оролдоно уу.', { id: t });
    } finally {
      setSyncing(null);
    }
  }, [supabase]);

  const musicDisconnect = useCallback(async (p: MusicProvider) => {
    const res = await fetch(`/api/${p}/disconnect`, { method: 'POST' });
    if (!res.ok) return void toast.error('Салгаж чадсангүй');
    if (p === 'spotify') setSpotify(null); else setYoutube(null);
    setProfile(x => ({ ...x, [`${p}_connected`]: false }));
    setLibraryVersion(v => v + 1);
    toast(`${PROVIDER_NAME[p]} салгагдлаа`);
  }, []);
  const updateProfile = useCallback(async (patch: Partial<Profile>) => {
    const prev = profile;
    setProfile(p => ({ ...p, ...patch }));
    const { error } = await supabase.from('profiles').update(patch).eq('id', profile.id);
    if (fail('Тохиргоо хадгалагдсангүй')(error)) setProfile(prev);
  }, [profile, supabase]);

  const addEntry = useCallback(async (d: EntryDraft) => {
    const { data, error } = await supabase.from('mood_entries')
      .insert({ ...d, entry_date: today(), entry_time: hhmm(new Date()) })
      .select(ENTRY_COLS).single<Entry>();
    if (fail('Бүртгэл хадгалагдсангүй')(error) || !data) return null;
    const e = normalizeEntry(data);
    setEntries(list => [...list, e]);
    setLiveMood(e.mood);
    return e;
  }, [supabase]);

  const setFeedback = useCallback((recId: string, value: number) => {
    setFb(f => ({ ...f, [recId]: value }));
    void supabase.from('rec_feedback').upsert({ user_id: profile.id, rec_id: recId, value }, { onConflict: 'user_id,rec_id' })
      .then(({ error }) => fail('Үнэлгээ хадгалагдсангүй')(error));
  }, [profile.id, supabase]);

  const toggleWatch = useCallback(async (recId: string) => {
    const has = watchlist.includes(recId);
    setWatch(w => (has ? w.filter(x => x !== recId) : [...w, recId]));
    const { error } = has
      ? await supabase.from('watchlist').delete().eq('rec_id', recId)
      : await supabase.from('watchlist').insert({ rec_id: recId });
    if (fail('Жагсаалт шинэчлэгдсэнгүй')(error)) setWatch(w => (has ? [...w, recId] : w.filter(x => x !== recId)));
    return !has;
  }, [watchlist, supabase]);

  const addBooking: AppCtx['addBooking'] = useCallback(async b => {
    const res = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
    if (res.status === 409) { toast.error('Энэ цаг дөнгөж захиалагдлаа. Өөр цаг сонгоно уу.'); return 'taken'; }
    if (!res.ok) { toast.error('Захиалга амжилтгүй боллоо'); return false; }
    const row: Booking = await res.json();
    setBookings(list => [...list, row].sort((x, y) => x.booking_date.localeCompare(y.booking_date)));
    return true;
  }, []);

  const cancelBooking = useCallback(async (id: string) => {
    const { error } = await supabase.from('bookings').delete().eq('id', id);
    if (!fail('Цуцалж чадсангүй')(error)) setBookings(list => list.filter(b => b.id !== id));
  }, [supabase]);

  const bumpExercises = useCallback(() => {
    setProfile(p => ({ ...p, exercises_done: p.exercises_done + 1 }));
    void supabase.rpc('increment_exercises').then(({ error }) => fail('Дасгал бүртгэгдсэнгүй')(error));
  }, [supabase]);

  const value = useMemo<AppCtx>(() => ({
    supabase, profile, entries, feedback, watchlist, bookings,
    experts: initial.experts, slots: initial.slots, isExpert: initial.isExpert, music: initial.music, spotify, youtube, recTracks,
    activeMood: liveMood ? moodById(liveMood) : lastMood(entries), setLiveMood,
    tint, setTint, updateProfile, addEntry, setFeedback, toggleWatch, addBooking, cancelBooking, bumpExercises,
    musicConnect, musicSync, musicDisconnect, musicSyncing, libraryVersion,
    dialog, openDialog,
  }), [supabase, profile, entries, feedback, watchlist, bookings, initial.experts, initial.slots, initial.isExpert, initial.music, spotify, youtube, recTracks,
    liveMood, tint, updateProfile, addEntry, setFeedback, toggleWatch, addBooking, cancelBooking, bumpExercises,
    musicConnect, musicSync, musicDisconnect, musicSyncing, libraryVersion, dialog]);

  return <Ctx value={value}>{children}</Ctx>;
}
