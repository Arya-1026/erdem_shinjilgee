-- =========================================================
-- 0006: Нас, дуртай дуучид, mood-ийн өөрийн зураг, таалагдсан дуунууд, төлөвлөгөө (todo)
-- =========================================================

alter table public.profiles
  add column if not exists birth_year  smallint check (birth_year between 1920 and 2020),
  add column if not exists fav_artists text[] not null default '{}',
  -- { "happy": "data:image/jpeg;base64,..." }: хөтөч дээр 128px болгож багасгасан зураг
  add column if not exists mood_images jsonb not null default '{}' check (pg_column_size(mood_images) < 400000);

-- ---------- Таалагдсан дуунууд (👍 дарсан AI-ийн санал) ----------
create table if not exists public.liked_songs (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  video_id    text not null,
  title       text not null,
  artist      text not null,
  thumbnail   text,
  duration_s  integer not null default 0,
  created_at  timestamptz not null default now(),
  primary key (user_id, video_id)
);
alter table public.liked_songs enable row level security;
drop policy if exists "own liked songs" on public.liked_songs;
create policy "own liked songs" on public.liked_songs
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------- Төлөвлөгөө ----------
create table if not exists public.todos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 200),
  category      text not null default 'Ажил',
  effort        smallint not null default 2 check (effort between 1 and 3),
  minutes       smallint not null default 30 check (minutes between 5 and 600),
  due_date      date,
  planned_date  date,
  reason        text not null default '',
  done          boolean not null default false,
  done_at       timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists todos_user_planned on public.todos (user_id, planned_date);
alter table public.todos enable row level security;
drop policy if exists "own todos" on public.todos;
create policy "own todos" on public.todos
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
