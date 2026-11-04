-- =========================================================
-- 0005: Апп-ын өнгө (анх орохдоо сонгоно), тайвшруулах ая (YouTube + LLM),
--       өдрийн сэтгэл санааны дэмжлэг (LLM)
-- =========================================================

-- ---------- Хэрэглэгчийн сонгосон өнгө (src/lib/palettes.ts) ----------
alter table public.profiles
  add column theme text not null default 'meadow'
  check (theme in ('meadow', 'water', 'dawn', 'lavender', 'rose'));

-- ---------- AI-ийн санал: дуу эсвэл ая ----------
alter table public.song_recs
  add column kind text not null default 'song' check (kind in ('song', 'ambient'));
alter table public.song_recs drop constraint song_recs_pkey;
alter table public.song_recs add primary key (user_id, mood, kind, video_id);

-- ---------- Өдрийн дэмжлэг: өдөрт нэг мөр, сүүлийн бүртгэл өөрчлөгдөхөд шинэчлэгдэнэ ----------
create table public.daily_support (
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  support_date  date not null,
  entry_id      uuid references public.mood_entries (id) on delete set null,
  mood          text not null,
  message       text not null,
  steps         jsonb not null default '[]',
  source        text not null default 'fallback',
  created_at    timestamptz not null default now(),
  primary key (user_id, support_date)
);
alter table public.daily_support enable row level security;
create policy "own daily support" on public.daily_support
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';
