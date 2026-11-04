-- =========================================================
-- 0004: YouTube холболт + хүн бүрт тохирсон дууны зөвлөмж
-- =========================================================

alter table public.profiles add column youtube_connected boolean not null default false;

-- OAuth token-ууд AES-GCM-ээр шифрлэгдсэн. Policy байхгүй → зөвхөн сервер (service key).
create table public.youtube_connections (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  channel_title  text not null default '',
  access_token   text not null,
  refresh_token  text not null,
  expires_at     timestamptz not null,
  synced_at      timestamptz,
  created_at     timestamptz not null default now()
);
alter table public.youtube_connections enable row level security;

-- Хэрэглэгчийн YouTube playlist, like-аас шүүсэн дуунууд + mood ангилал
create table public.youtube_tracks (
  user_id     uuid not null references auth.users (id) on delete cascade,
  video_id    text not null,
  title       text not null,
  artist      text not null,
  thumbnail   text,
  duration_s  integer not null default 0,
  moods       text[] not null default '{}',
  primary key (user_id, video_id)
);
alter table public.youtube_tracks enable row level security;
create policy "read own youtube tracks" on public.youtube_tracks for select to authenticated using ((select auth.uid()) = user_id);

-- YouTube бичлэгийн ангиллын нийтийн cache: дуу мөн эсэх, уран бүтээлч, нэр, mood. Зөвхөн сервер.
create table public.video_info (
  video_id       text primary key,
  is_music       boolean not null,
  title          text not null default '',
  artist         text not null default '',
  moods          text[] not null default '{}',
  classified_at  timestamptz not null default now()
);
alter table public.video_info enable row level security;

-- "Уран бүтээлч - дуу" → YouTube бичлэг. search.list өдөрт 100 удаагийн хязгаартай тул бүх хэрэглэгч хуваалцана.
create table public.song_cache (
  query_key   text primary key,
  found       boolean not null,
  video_id    text,
  title       text,
  channel     text,
  thumbnail   text,
  duration_s  integer,
  cached_at   timestamptz not null default now()
);
alter table public.song_cache enable row level security;

-- Хүн бүрт AI-ийн санал болгосон дуунууд (mood тус бүрээр, 7 хоног хадгална)
create table public.song_recs (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mood        text not null check (mood in ('happy', 'calm', 'neutral', 'tired', 'anxious', 'sad', 'angry')),
  video_id    text not null,
  title       text not null,
  artist      text not null,
  thumbnail   text,
  duration_s  integer not null default 0,
  reason      text not null default '',
  position    smallint not null default 0,
  created_at  timestamptz not null default now(),
  primary key (user_id, mood, video_id)
);
alter table public.song_recs enable row level security;
create policy "own song recs" on public.song_recs
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create function public.youtube_status()
returns table (channel_title text, synced_at timestamptz, track_count integer)
language sql stable security definer set search_path = '' as $$
  select c.channel_title, c.synced_at, (select count(*)::int from public.youtube_tracks t where t.user_id = c.user_id)
  from public.youtube_connections c where c.user_id = (select auth.uid());
$$;
grant execute on function public.youtube_status() to authenticated;
