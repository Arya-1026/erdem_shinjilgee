'use client';

import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { lastMood } from '@/lib/analytics';
import { DAY_NOTE_COLS, ENTRY_COLS, JOURNAL_COLS, normalizeEntry } from '@/lib/db';
import { hhmm, today } from '@/lib/date';
import { languageSync } from '@/lib/i18n';
import { applyPalette, DEFAULT_PALETTE, isPaletteId } from '@/lib/palettes';
import { createClient } from '@/lib/supabase/client';
import type { AppData } from '@/lib/server/dal';
import type { Booking, DayJournal, DayNote, Entry, EntryDraft, LikedSong, Mood, MoodId, Profile, Todo } from '@/lib/types';
import { useLocale, useT } from '@/components/providers/locale-provider';

// Нээгдэх цонхнууд (хуучин showModal-ын оронд)
export type DialogState =
  | { kind: 'saved'; mood: MoodId }
  | { kind: 'dass'; mood: MoodId }
  | { kind: 'exercise'; recId: string }
  | { kind: 'breath' }
  | { kind: 'movie'; recId: string; mood: MoodId }
  | { kind: 'book'; expertId: string }
  | { kind: 'wipe' }
  | { kind: 'journal'; date: string }
  | null;

type AppCtx = Omit<AppData, 'restored'> & {
  supabase: ReturnType<typeof createClient>;
  /** Хамгийн сүүлд хадгалсан бүртгэлийн mood. Carousel, зөвлөмжийн түр сонголт үүнд нөлөөлөхгүй. */
  activeMood: Mood;
  /** Нүүр хуудасны дэвсгэрийн өнгө (carousel дээр сонгож буй mood). React state биш, --mc CSS хувьсагчийг шууд солино:
   *  carousel эргэх бүрт бүх апп дахин render хийгдэж утсан дээр гацдаг байсан */
  setTint: (c: string) => void;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  addEntry: (d: EntryDraft) => Promise<Entry | null>;
  /** Нэмэлт тэмдэглэл: сэтгэл хөдлөлийн бүртгэлд хүрэхгүй, тусдаа хадгална */
  addDayNote: (day: string, body: string) => Promise<boolean>;
  /** Өдрийн тэмдэглэл: өдөрт нэг, дахин хадгалахад шинэчлэгдэнэ */
  saveJournal: (day: string, mood: MoodId | null, body: string) => Promise<boolean>;
  setFeedback: (recId: string, value: number) => void;
  toggleWatch: (recId: string) => Promise<boolean>;
  /** true: амжилттай, 'taken': цаг өөр хүнд дөнгөж захиалагдсан, false: алдаа */
  addBooking: (b: { expertId: string; date: string; slot: string; kind: 'video' | 'chat'; share: boolean }) => Promise<boolean | 'taken'>;
  cancelBooking: (id: string) => Promise<void>;
  bumpExercises: () => void;
  /** 👍: дууг «Таалагдсан дуунууд»-д хадгална, дахин дарвал хасна */
  toggleLike: (s: LikedSong) => void;
  setTodos: React.Dispatch<React.SetStateAction<Todo[]>>;
  dialog: DialogState;
  openDialog: (d: DialogState) => void;
  /** Хөвөгч чатын самбар */
  chatOpen: boolean;
  setChatOpen: (b: boolean) => void;
};


const Ctx = createContext<AppCtx | null>(null);

const setTint = (c: string) => document.documentElement.style.setProperty('--mc', c);

// Supabase алдааг toast-оор харуулна. Алдаа гарсан бол true буцаана.
const fail = (msg: string) => (e: { message: string } | null) => { if (e) toast.error(`${msg}: ${e.message}`); return Boolean(e); };

export function useApp() {
  const c = use(Ctx);
  if (!c) throw new Error('useApp must be used within AppProvider');
  return c;
}

export function AppProvider({ initial, children }: { initial: AppData; children: React.ReactNode }) {
  const tr = useT();
  const { locale, picked, setLocale } = useLocale();
  const [supabase] = useState(createClient);
  const [profile, setProfile] = useState(initial.profile);
  const [entries, setEntries] = useState(initial.entries);
  const [feedback, setFb] = useState(initial.feedback);
  const [watchlist, setWatch] = useState(initial.watchlist);
  const [bookings, setBookings] = useState(initial.bookings);
  const [dialog, openDialog] = useState<DialogState>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [likedSongs, setLiked] = useState(initial.likedSongs);
  const [journals, setJournals] = useState(initial.journals);
  const [dayNotes, setDayNotes] = useState(initial.dayNotes);
  const [todos, setTodos] = useState(initial.todos);

  // Хэрэглэгчийн сонгосон өнгө (өөр төхөөрөмж дээр сонгосон байж болно → localStorage-тай тааруулна)
  useEffect(() => { applyPalette(isPaletteId(profile.theme) ? profile.theme : DEFAULT_PALETTE); }, [profile.theme]);

  // Энэ төхөөрөмж дээр сонгосон хэлийг профайлд хадгална (имэйл, сануулга энэ хэлээр очно).
  // Сонголт хийгээгүй төхөөрөмж дээр профайлын хэлийг ашиглана.
  useEffect(() => {
    const { use, save } = languageSync(picked, profile.language, locale);
    if (use) setLocale(use);
    // Supabase-ийн query нь .then() дуудагдах үед л явна
    if (save) void supabase.from('profiles').update({ language: save }).eq('id', profile.id).then(() => {});
  }, [profile.language, profile.id, locale, picked, setLocale, supabase]);

  // Устгах хүсэлт гаргасан бүртгэлээр 30 хоногийн дотор нэвтэрвэл сэргээгдсэнийг мэдэгдэнэ
  useEffect(() => { if (initial.restored) toast(tr('Тавтай морил! Таны бүртгэл сэргээгдлээ, устгах хүсэлт цуцлагдсан 💜')); }, [initial.restored, tr]);

  const updateProfile = useCallback(async (patch: Partial<Profile>) => {
    const prev = profile;
    setProfile(p => ({ ...p, ...patch }));
    const { error } = await supabase.from('profiles').update(patch).eq('id', profile.id);
    if (fail(tr('Тохиргоо хадгалагдсангүй'))(error)) setProfile(prev);
  }, [profile, supabase, tr]);

  const addEntry = useCallback(async (d: EntryDraft) => {
    const { data, error } = await supabase.from('mood_entries')
      .insert({ ...d, entry_date: today(), entry_time: hhmm(new Date()) })
      .select(ENTRY_COLS).single<Entry>();
    if (fail(tr('Бүртгэл хадгалагдсангүй'))(error) || !data) return null;
    const e = normalizeEntry(data);
    // Хадгалагдсан мөрөөс шалгана: тэмдэглэл чимээгүй алдагдахгүй
    if (d.note && e.note !== d.note) toast.error(tr('Тэмдэглэл хадгалагдсангүй. Дахин оролдоно уу.'));
    setEntries(list => [...list, e]);
    return e;
  }, [supabase, tr]);

  const addDayNote = useCallback(async (day: string, body: string) => {
    const { data, error } = await supabase.from('day_notes').insert({ day, body }).select(DAY_NOTE_COLS).single<DayNote>();
    if (fail(tr('Тэмдэглэл хадгалагдсангүй. Дахин оролдоно уу.'))(error) || !data) return false;
    setDayNotes(l => [...l, data]);
    return true;
  }, [supabase, tr]);

  const saveJournal = useCallback(async (day: string, mood: MoodId | null, body: string) => {
    const { data, error } = await supabase.from('day_journals').upsert({ user_id: profile.id, day, mood, body, updated_at: new Date().toISOString() }, { onConflict: 'user_id,day' }).select(JOURNAL_COLS).single<DayJournal>();
    if (fail(tr('Тэмдэглэл хадгалагдсангүй. Дахин оролдоно уу.'))(error) || !data) return false;
    setJournals(l => [...l.filter(j => j.day !== day), data]);
    return true;
  }, [profile.id, supabase, tr]);

  const setFeedback = useCallback((recId: string, value: number) => {
    setFb(f => ({ ...f, [recId]: value }));
    void supabase.from('rec_feedback').upsert({ user_id: profile.id, rec_id: recId, value }, { onConflict: 'user_id,rec_id' })
      .then(({ error }) => fail(tr('Үнэлгээ хадгалагдсангүй'))(error));
  }, [profile.id, supabase, tr]);

  const toggleWatch = useCallback(async (recId: string) => {
    const has = watchlist.includes(recId);
    setWatch(w => (has ? w.filter(x => x !== recId) : [...w, recId]));
    const { error } = has
      ? await supabase.from('watchlist').delete().eq('rec_id', recId)
      : await supabase.from('watchlist').insert({ rec_id: recId });
    if (fail(tr('Жагсаалт шинэчлэгдсэнгүй'))(error)) setWatch(w => (has ? [...w, recId] : w.filter(x => x !== recId)));
    return !has;
  }, [watchlist, supabase, tr]);

  const addBooking: AppCtx['addBooking'] = useCallback(async b => {
    const res = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
    if (res.status === 409) { toast.error(tr('Энэ цаг дөнгөж захиалагдлаа. Өөр цаг сонгоно уу.')); return 'taken'; }
    if (!res.ok) { toast.error(tr('Захиалга амжилтгүй боллоо')); return false; }
    const row: Booking = await res.json();
    setBookings(list => [...list, row].sort((x, y) => x.booking_date.localeCompare(y.booking_date)));
    return true;
  }, [tr]);

  const cancelBooking = useCallback(async (id: string) => {
    const { error } = await supabase.from('bookings').delete().eq('id', id);
    if (!fail(tr('Цуцалж чадсангүй'))(error)) setBookings(list => list.filter(b => b.id !== id));
  }, [supabase, tr]);

  const bumpExercises = useCallback(() => {
    setProfile(p => ({ ...p, exercises_done: p.exercises_done + 1 }));
    void supabase.rpc('increment_exercises').then(({ error }) => fail(tr('Дасгал бүртгэгдсэнгүй'))(error));
  }, [supabase, tr]);

  const toggleLike = useCallback((s: LikedSong) => {
    const has = likedSongs.some(x => x.video_id === s.video_id);
    const id = 'sp:' + s.video_id;
    setLiked(l => (has ? l.filter(x => x.video_id !== s.video_id) : [s, ...l]));
    setFeedback(id, has ? 0 : 1);
    const { video_id, title, artist, thumbnail, duration_s } = s;
    void (has ? supabase.from('liked_songs').delete().eq('video_id', video_id) : supabase.from('liked_songs').insert({ video_id, title, artist, thumbnail, duration_s }))
      .then(({ error }) => fail(tr('Дуу хадгалагдсангүй'))(error));
  }, [likedSongs, setFeedback, supabase, tr]);

  const value = useMemo<AppCtx>(() => ({
    supabase, profile, entries, feedback, watchlist, bookings,
    experts: initial.experts, slots: initial.slots, isExpert: initial.isExpert, music: initial.music, likedSongs, todos, journals, dayNotes, setTodos, toggleLike,
    activeMood: lastMood(entries),
    setTint, updateProfile, addEntry, addDayNote, saveJournal, setFeedback, toggleWatch, addBooking, cancelBooking, bumpExercises,
    dialog, openDialog, chatOpen, setChatOpen,
  }), [supabase, profile, entries, feedback, watchlist, bookings, initial.experts, initial.slots, initial.isExpert, initial.music, likedSongs, todos, journals, dayNotes, toggleLike,
    updateProfile, addEntry, addDayNote, saveJournal, setFeedback, toggleWatch, addBooking, cancelBooking, bumpExercises,
    dialog, chatOpen]);

  return <Ctx value={value}>{children}</Ctx>;
}
