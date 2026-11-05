// Клиент, сервер хоёуланд хэрэглэгдэх баганын жагсаалт
export const PROFILE_COLS = 'id,name,email,hobbies,theme,reminder_time,reminder_enabled,art_mode,chat_mode,spotify_connected,exercises_done,birth_year,fav_artists,mood_images,avatar,handle,profile_visibility,mood_visibility,message_permission,friends_visibility,show_active,note_text,note_mood,note_at';
export const TODO_COLS = 'id,title,category,effort,minutes,due_date,planned_date,planned_time,emoji,reason,done,done_at';
export const SONG_COLS = 'video_id,title,artist,thumbnail,duration_s';
export const ENTRY_COLS = 'id,entry_date,entry_time,mood,intensity,tags,note,sleep';
export const BOOKING_COLS = 'id,expert_id,booking_date,slot,kind,share_report,status,meeting_url';
export const EXPERT_COLS = 'id,name,title,spec,experience_years,rating,price,color';
export const SPOTIFY_TRACK_COLS = 'track_id,name,artists,uri,duration_ms,image';

export const toExpert = (r: { id: string; name: string; title: string; spec: string[]; experience_years: number; rating: number | string; price: number; color: string }) =>
  ({ id: r.id, name: r.name, title: r.title, spec: r.spec, exp: r.experience_years, rating: Number(r.rating), price: r.price, color: r.color });

export function groupSlots(rows: { expert_id: string; weekday: number; slot: string }[]) {
  const out: Record<string, Record<number, string[]>> = {};
  for (const r of rows) ((out[r.expert_id] ??= {})[r.weekday] ??= []).push(r.slot);
  Object.values(out).forEach(w => Object.values(w).forEach(s => s.sort()));
  return out;
}

// Postgres numeric → string, time → HH:MM:SS ирдэг тул нэг хэлбэрт оруулна
export const normalizeEntry = <T extends { sleep: unknown; entry_time: string }>(e: T) =>
  ({ ...e, sleep: e.sleep == null ? null : Number(e.sleep), entry_time: e.entry_time.slice(0, 5) });
