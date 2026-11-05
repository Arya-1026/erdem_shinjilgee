import type { Move } from './exercise-moves';

import type { PaletteId } from './palettes';

export type MoodId = 'happy' | 'calm' | 'neutral' | 'tired' | 'anxious' | 'sad' | 'angry';
export type ChatMode = 'calm' | 'motivate' | 'listen';
export type RecType = 'exercise' | 'movie';

export type Mood = { id: MoodId; label: string; emoji: string; color: string; score: number };

export type Rec = {
  id: string;
  type: RecType;
  title: string;
  sub: string;
  moods: MoodId[];
  hobby?: string[];
  steps?: string[];
  desc?: string;
  action?: 'breath';
  /** Киноны постер */
  poster?: string;
  /** 3D загварыг дагаж хийх алхмууд */
  moves?: Move[];
};
export type ScoredRec = Rec & { hob: boolean; fb: number; score: number };

export type Expert = {
  id: string;
  name: string;
  title: string;
  spec: string[];
  exp: number;
  rating: number;
  price: number;
  color: string;
};

/* ---------- Өгөгдлийн сангийн мөрүүд (supabase/migrations/0001_init.sql) ---------- */
export type Profile = {
  id: string;
  name: string;
  email: string;
  hobbies: string[];
  /** Апп-ын үндсэн өнгө (lib/palettes.ts) */
  theme: PaletteId;
  reminder_time: string;
  reminder_enabled: boolean;
  art_mode: 'emoji' | 'art';
  chat_mode: ChatMode;
  spotify_connected: boolean;
  youtube_connected: boolean;
  exercises_done: number;
  birth_year: number | null;
  fav_artists: string[];
  /** Хэрэглэгчийн өөрийн оруулсан mood-ийн зураг (data URL) */
  mood_images: Partial<Record<MoodId, string>>;
  /** Профайл зураг (data URL), байхгүй бол нэрийн эхний үсэг */
  avatar: string | null;
};

export type Entry = {
  id: string;
  entry_date: string; // YYYY-MM-DD
  entry_time: string; // HH:MM[:SS]
  mood: MoodId;
  intensity: number;
  tags: string[];
  note: string;
  sleep: number | null;
};
export type EntryDraft = Pick<Entry, 'mood' | 'intensity' | 'tags' | 'note' | 'sleep'>;

export type Booking = {
  id: string;
  expert_id: string;
  booking_date: string;
  slot: string;
  kind: 'video' | 'chat';
  share_report: boolean;
  status: 'booked' | 'done' | 'cancelled';
  meeting_url: string | null;
};

/** expert_id → гараг (0 = Ням) → цагууд */
export type ExpertSlots = Record<string, Record<number, string[]>>;

export type SpotifyStatus = { display_name: string; synced_at: string | null; track_count: number };
export type YouTubeStatus = { channel_title: string; synced_at: string | null; track_count: number };
/** Сервер дээр аль хөгжмийн үйлчилгээ тохируулагдсан бэ (түлхүүр байгаа эсэх) */
export type MusicConfig = { spotify: boolean; youtube: boolean; discovery: boolean };
export type YouTubeTrackRow = { video_id: string; title: string; artist: string; thumbnail: string | null; duration_s: number };
export type SongRec = YouTubeTrackRow & { reason: string };
export type SpotifyTrackRow = { track_id: string; name: string; artists: string; uri: string; duration_ms: number; image: string | null };

export type ChatMessage = { id: number | string; role: 'user' | 'assistant'; content: string; crisis: boolean };

export type LikedSong = YouTubeTrackRow;

export type Todo = {
  id: string;
  title: string;
  category: string;
  /** 1 хөнгөн, 2 дунд, 3 хүнд */
  effort: number;
  minutes: number;
  due_date: string | null;
  planned_date: string | null;
  /** "HH:MM:SS" (Postgres time) */
  planned_time: string | null;
  /** Календарь дээр харагдах эможи */
  emoji: string | null;
  /** Яагаад энэ өдөрт хуваарилсан тайлбар */
  reason: string;
  done: boolean;
  done_at: string | null;
};
