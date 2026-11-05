-- АВТОМАТААР ҮҮСГЭСЭН (npm run db:bundle). Засах бол supabase/migrations/ доторх файлыг засна.
-- Supabase → SQL Editor → New query → энэ файлын бүх агуулгыг хуулж → Run. Хоосон төсөл дээр нэг удаа ажиллуулна.
begin;

-- >>>>>>>>>> 0001_init.sql
-- =========================================================
-- Сэтгэл: Mood Tracker. Анхны schema
-- RLS: хэрэглэгч бүр зөвхөн өөрийнхөө мөрийг харж, өөрчилнө.
-- =========================================================

-- ---------- Профайл ----------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  name              text not null default '',
  email             text not null default '',
  hobbies           text[] not null default '{}',
  reminder_time     time not null default '21:00',
  reminder_enabled  boolean not null default true,
  timezone          text not null default 'Asia/Ulaanbaatar',
  art_mode          text not null default 'emoji' check (art_mode in ('emoji', 'art')),
  chat_mode         text not null default 'calm' check (chat_mode in ('calm', 'motivate', 'listen')),
  spotify_connected boolean not null default false,
  exercises_done    integer not null default 0,
  last_reminded_on  date,
  created_at        timestamptz not null default now()
);

-- Бүртгүүлэхэд профайл автоматаар үүснэ (имэйл болон Google хоёуланд)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1), ''),
    coalesce(new.email, '')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Энэ migration-ээс өмнө бүртгүүлсэн хэрэглэгчдэд профайл үүсгэнэ
insert into public.profiles (id, name, email)
select id, coalesce(raw_user_meta_data ->> 'name', raw_user_meta_data ->> 'full_name', split_part(email, '@', 1), ''), coalesce(email, '')
from auth.users
on conflict (id) do nothing;

-- ---------- Mood бүртгэл ----------
create table public.mood_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date  date not null,
  entry_time  time not null,
  mood        text not null check (mood in ('happy', 'calm', 'neutral', 'tired', 'anxious', 'sad', 'angry')),
  intensity   smallint not null default 3 check (intensity between 1 and 5),
  tags        text[] not null default '{}',
  note        text not null default '',
  sleep       numeric(3, 1) check (sleep between 0 and 24),
  created_at  timestamptz not null default now()
);
create index mood_entries_user_date on public.mood_entries (user_id, entry_date);

-- ---------- Зөвлөмжийн үнэлгээ (👍 = 1, 👎 = -1) ----------
create table public.rec_feedback (
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rec_id   text not null,
  value    smallint not null check (value in (-1, 0, 1)),
  primary key (user_id, rec_id)
);

-- ---------- Үзэх жагсаалт ----------
create table public.watchlist (
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rec_id   text not null,
  primary key (user_id, rec_id)
);

-- ---------- Сэтгэл зүйчийн захиалга ----------
create table public.bookings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  expert_id     text not null,
  booking_date  date not null,
  slot          text not null,
  kind          text not null check (kind in ('video', 'chat')),
  share_report  boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ---------- Чатын түүх ----------
create table public.chat_messages (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  crisis      boolean not null default false,
  created_at  timestamptz not null default now()
);
create index chat_messages_user on public.chat_messages (user_id, created_at);

-- ---------- RLS ----------
alter table public.profiles      enable row level security;
alter table public.mood_entries  enable row level security;
alter table public.rec_feedback  enable row level security;
alter table public.watchlist     enable row level security;
alter table public.bookings      enable row level security;
alter table public.chat_messages enable row level security;

create policy "own profile" on public.profiles
  for all to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "own entries" on public.mood_entries
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own feedback" on public.rec_feedback
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own watchlist" on public.watchlist
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "own bookings" on public.bookings
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Чатын мессежийг зөвхөн /api/chat (сервер) бичнэ. Хэрэглэгч уншиж, устгаж болно.
create policy "read own chat" on public.chat_messages
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "delete own chat" on public.chat_messages
  for delete to authenticated using ((select auth.uid()) = user_id);
create policy "insert own chat" on public.chat_messages
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- ---------- Дасгалын тоолуур (race condition-гүй нэмэгдүүлэх) ----------
create function public.increment_exercises() returns integer
language sql security invoker set search_path = '' as $$
  update public.profiles set exercises_done = exercises_done + 1
  where id = (select auth.uid())
  returning exercises_done;
$$;

-- ---------- Сануулга ----------
-- Сануулах цаг нь сүүлийн 10 минутад орсон, өнөөдөр mood бүртгээгүй,
-- өнөөдөр сануулга аваагүй хэрэглэгчдийг буцаана. Зөвхөн service_role дуудна.
create function public.due_reminders()
returns table (user_id uuid, email text, name text)
language sql security definer set search_path = '' as $$
  select p.id, p.email, p.name
  from public.profiles p
  where p.reminder_enabled
    and p.email <> ''
    and (now() at time zone p.timezone)::time >= p.reminder_time
    and (now() at time zone p.timezone)::time <  p.reminder_time + interval '10 minutes'
    and p.last_reminded_on is distinct from (now() at time zone p.timezone)::date
    and not exists (
      select 1 from public.mood_entries e
      where e.user_id = p.id and e.entry_date = (now() at time zone p.timezone)::date
    );
$$;
revoke execute on function public.due_reminders() from public, anon, authenticated;
grant execute on function public.due_reminders() to service_role;

-- Сануулга илгээсэн хэрэглэгчдийг тухайн хүний цагийн бүсийн "өнөөдөр"-өөр тэмдэглэнэ
create function public.mark_reminded(ids uuid[]) returns void
language sql security definer set search_path = '' as $$
  update public.profiles set last_reminded_on = (now() at time zone timezone)::date
  where id = any (ids);
$$;
revoke execute on function public.mark_reminded(uuid[]) from public, anon, authenticated;
grant execute on function public.mark_reminded(uuid[]) to service_role;

-- >>>>>>>>>> 0003_experts_push_spotify.sql
-- =========================================================
-- 0003: Сэтгэл зүйчид (хуваарь, портал), Web Push, Spotify
-- =========================================================

-- ---------- Сэтгэл зүйчид ----------
create table public.experts (
  id                text primary key,
  -- Сэтгэл зүйчийн өөрийн нэвтрэх бүртгэл (портал руу орох эрх). Админ SQL-ээр онооно.
  user_id           uuid unique references auth.users (id) on delete set null,
  name              text not null,
  title             text not null,
  spec              text[] not null default '{}',
  experience_years  integer not null default 0,
  rating            numeric(2, 1) not null default 5.0,
  price             integer not null,
  color             text not null default '#7C5CFF',
  active            boolean not null default true
);

-- Долоо хоногийн тогтмол хуваарь: гараг (0 = Ням) + цаг
create table public.expert_slots (
  expert_id  text not null references public.experts (id) on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6),
  slot       text not null check (slot ~ '^\d{2}:\d{2}$'),
  primary key (expert_id, weekday, slot)
);

alter table public.experts      enable row level security;
alter table public.expert_slots enable row level security;
create policy "read active experts" on public.experts for select to authenticated using (active);
create policy "read slots" on public.expert_slots for select to authenticated using (true);

insert into public.experts (id, name, title, spec, experience_years, rating, price, color) values
  ('p1', 'Б. Сарангэрэл', 'Клиник сэтгэл зүйч',      '{Түгшүүр,Стресс}',        8,  4.9, 60000, '#8B5CF6'),
  ('p2', 'Д. Тэмүүлэн',   'Зөвлөх сэтгэл зүйч',      '{Харилцаа,"Гэр бүл"}',    6,  4.8, 50000, '#10B981'),
  ('p3', 'Г. Номин',      'Өсвөр насны сэтгэл зүйч', '{"Өсвөр нас",Стресс}',    10, 4.9, 55000, '#F59E0B'),
  ('p4', 'Э. Бат-Эрдэнэ', 'Сэтгэл засалч',           '{"Сэтгэл гутрал",Нойр}',  12, 4.7, 70000, '#3B82F6');

-- Даваа–Бямба гаригт 6 цаг, сэтгэл зүйч бүрд өөр өөр чөлөөтэй цагтай
insert into public.expert_slots (expert_id, weekday, slot)
select e.id, wd, s.slot
from public.experts e
cross join generate_series(1, 6) as wd
cross join unnest(array['10:00', '11:30', '14:00', '15:30', '17:00', '19:00']) with ordinality as s(slot, n)
where (wd + s.n + ascii(substr(e.id, 2, 1))) % 4 <> 0;

-- ---------- Захиалга: хуваарьтай холбох, давхар захиалгаас сэргийлэх ----------
alter table public.bookings
  add constraint bookings_expert_fk foreign key (expert_id) references public.experts (id),
  add constraint bookings_unique_slot unique (expert_id, booking_date, slot),
  add column status text not null default 'booked' check (status in ('booked', 'done', 'cancelled')),
  add column meeting_url text;

-- Захиалагдсан цагуудыг (хэн захиалсныг ил гаргахгүйгээр) буцаана
create function public.booked_slots(p_expert text, p_from date, p_to date)
returns table (booking_date date, slot text)
language sql stable security definer set search_path = '' as $$
  select b.booking_date, b.slot from public.bookings b
  where b.expert_id = p_expert and b.booking_date between p_from and p_to and b.status <> 'cancelled';
$$;
grant execute on function public.booked_slots(text, date, date) to authenticated;

-- ---------- Сэтгэл зүйчийн портал ----------
create function public.my_expert_id() returns text
language sql stable security definer set search_path = '' as $$
  select id from public.experts where user_id = (select auth.uid());
$$;
grant execute on function public.my_expert_id() to authenticated;

-- Нэвтэрсэн сэтгэл зүйчийн захиалгууд + үйлчлүүлэгчийн нэр
create function public.expert_bookings()
returns table (id uuid, booking_date date, slot text, kind text, share_report boolean, status text, meeting_url text, client_name text)
language sql stable security definer set search_path = '' as $$
  select b.id, b.booking_date, b.slot, b.kind, b.share_report, b.status, b.meeting_url, p.name
  from public.bookings b
  join public.experts x on x.id = b.expert_id and x.user_id = (select auth.uid())
  join public.profiles p on p.id = b.user_id
  order by b.booking_date, b.slot;
$$;
grant execute on function public.expert_bookings() to authenticated;

-- Үйлчлүүлэгч зөвшөөрсөн бол захиалга үүсгэхээс өмнөх 30 хоногийн mood тайлан.
-- Хувийн тэмдэглэл (note) хуваалцагдахгүй.
create function public.expert_report(p_booking uuid)
returns table (entry_date date, mood text, intensity smallint, tags text[], sleep numeric)
language sql stable security definer set search_path = '' as $$
  select e.entry_date, e.mood, e.intensity, e.tags, e.sleep
  from public.bookings b
  join public.experts x on x.id = b.expert_id and x.user_id = (select auth.uid())
  join public.mood_entries e on e.user_id = b.user_id
  where b.id = p_booking and b.share_report
    and e.entry_date between (b.created_at::date - 30) and b.booking_date
  order by e.entry_date, e.entry_time;
$$;
grant execute on function public.expert_report(uuid) to authenticated;

-- Сэтгэл зүйч уулзалтын холбоос, төлөвөө шинэчилнэ
create function public.expert_update_booking(p_booking uuid, p_status text, p_meeting_url text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('booked', 'done', 'cancelled') then raise exception 'invalid status'; end if;
  if p_meeting_url is not null and p_meeting_url !~ '^https://' then raise exception 'meeting url must be https'; end if;
  update public.bookings b set status = p_status, meeting_url = nullif(p_meeting_url, '')
  from public.experts x
  where b.id = p_booking and x.id = b.expert_id and x.user_id = (select auth.uid());
  if not found then raise exception 'not allowed'; end if;
end $$;
grant execute on function public.expert_update_booking(uuid, text, text) to authenticated;

-- ---------- Web Push subscription ----------
create table public.push_subscriptions (
  endpoint    text primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "own push subs" on public.push_subscriptions
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------- Spotify ----------
-- Token-ууд AES-GCM-ээр шифрлэгдсэн (TOKEN_ENCRYPTION_KEY). Policy байхгүй → зөвхөн сервер (service key) уншина.
create table public.spotify_connections (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  spotify_user_id  text not null,
  display_name     text not null default '',
  access_token     text not null,
  refresh_token    text not null,
  expires_at       timestamptz not null,
  scope            text not null default '',
  synced_at        timestamptz,
  created_at       timestamptz not null default now()
);
alter table public.spotify_connections enable row level security;

-- Хэрэглэгчийн playlist, liked songs-оос татсан дуунууд + mood ангилал
create table public.spotify_tracks (
  user_id      uuid not null references auth.users (id) on delete cascade,
  track_id     text not null,
  name         text not null,
  artists      text not null,
  image        text,
  uri          text not null,
  duration_ms  integer not null,
  moods        text[] not null default '{}',
  primary key (user_id, track_id)
);
alter table public.spotify_tracks enable row level security;
create policy "read own spotify tracks" on public.spotify_tracks for select to authenticated using ((select auth.uid()) = user_id);

-- Дууны mood ангиллын нийтийн cache (нэг дууг дахин LLM-ээр ангилахгүй). Зөвхөн сервер.
create table public.track_moods (
  track_id       text primary key,
  moods          text[] not null,
  source         text not null check (source in ('llm', 'heuristic')),
  classified_at  timestamptz not null default now()
);
alter table public.track_moods enable row level security;

-- Апп-ын зөвлөмжийн дуунуудын (s1..s8) Spotify хувилбар. Нууц биш тул бүгд уншина.
create table public.rec_tracks (
  rec_id       text primary key,
  track_id     text not null,
  uri          text not null,
  name         text not null,
  artists      text not null,
  image        text,
  duration_ms  integer not null
);
alter table public.rec_tracks enable row level security;
create policy "read rec tracks" on public.rec_tracks for select to authenticated using (true);

create function public.spotify_status()
returns table (display_name text, synced_at timestamptz, track_count integer)
language sql stable security definer set search_path = '' as $$
  select c.display_name, c.synced_at, (select count(*)::int from public.spotify_tracks t where t.user_id = c.user_id)
  from public.spotify_connections c where c.user_id = (select auth.uid());
$$;
grant execute on function public.spotify_status() to authenticated;

-- >>>>>>>>>> 0004_youtube_music.sql
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

-- >>>>>>>>>> 0005_theme_ambient_support.sql
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

-- >>>>>>>>>> 0006_personal.sql
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

-- >>>>>>>>>> 0007_grants.sql
-- =========================================================
-- 0007: Data API-ийн эрх. Шинэ Supabase төслүүд public schema-гийн хүснэгтэд
-- anon/authenticated/service_role-д автоматаар эрх олгохоо больсон
-- ("permission denied for table ..."). Мөр бүрийг RLS хамгаалсаар байна.
-- anon-д эрх өгөхгүй: апп зөвхөн нэвтэрсэн хэрэглэгчид өгөгдөл харуулна.
-- =========================================================

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- Цаашид үүсэх хүснэгтэд ч мөн адил
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;

notify pgrst, 'reload schema';

-- >>>>>>>>>> 0008_todo_time_emoji.sql
-- =========================================================
-- 0008: Төлөвлөгөөний цаг, эможи (календарь дээр харагдана)
-- =========================================================

alter table public.todos
  add column if not exists planned_time time,
  add column if not exists emoji text check (char_length(emoji) <= 16);

notify pgrst, 'reload schema';

-- >>>>>>>>>> 0009_account_deletion.sql
-- =========================================================
-- 0009: Бүртгэл устгах хүсэлт 30 хоног хүлээгдэнэ.
-- Энэ хугацаанд дахин нэвтэрвэл сэргээгдэнэ (dal.ts → requireUser),
-- нэвтрэхгүй бол /api/cron/purge-accounts бүрмөсөн устгана (0010_purge_cron.sql).
-- =========================================================

alter table public.profiles add column if not exists deletion_requested_at timestamptz;

-- Устгах хугацаа нь болсон хэрэглэгчид. Зөвхөн service_role дуудна.
create or replace function public.due_deletions()
returns table (user_id uuid)
language sql security definer set search_path = '' as $$
  select p.id from public.profiles p
  where p.deletion_requested_at is not null
    and p.deletion_requested_at < now() - interval '30 days';
$$;
revoke execute on function public.due_deletions() from public, anon, authenticated;
grant execute on function public.due_deletions() to service_role;

-- Устгах хүсэлттэй хүнд сануулга илгээхгүй
create or replace function public.due_reminders()
returns table (user_id uuid, email text, name text)
language sql security definer set search_path = '' as $$
  select p.id, p.email, p.name
  from public.profiles p
  where p.reminder_enabled
    and p.deletion_requested_at is null
    and p.email <> ''
    and (now() at time zone p.timezone)::time >= p.reminder_time
    and (now() at time zone p.timezone)::time <  p.reminder_time + interval '10 minutes'
    and p.last_reminded_on is distinct from (now() at time zone p.timezone)::date
    and not exists (
      select 1 from public.mood_entries e
      where e.user_id = p.id and e.entry_date = (now() at time zone p.timezone)::date
    );
$$;
revoke execute on function public.due_reminders() from public, anon, authenticated;
grant execute on function public.due_reminders() to service_role;

notify pgrst, 'reload schema';

-- >>>>>>>>>> 0011_avatar.sql
-- =========================================================
-- 0011: Профайл зураг. Хөтөч дээр 256px болгож багасгасан data URL (~20–40KB).
-- =========================================================

alter table public.profiles
  add column if not exists avatar text check (avatar is null or (avatar like 'data:image/%' and char_length(avatar) < 200000));

notify pgrst, 'reload schema';

-- >>>>>>>>>> 0012_social.sql
-- =========================================================
-- 0012: Найзууд, найзын хүсэлт, блок, хэрэглэгч хоорондын зурвас, нууцлалын тохиргоо.
-- Бусдын профайл, mood-ийг зөвхөн доорх security definer функцээр (нууцлал, блокийг шалгаж) уншина.
-- Хүснэгтүүдэд insert/update policy байхгүй: өөрчлөлт бүр функцээр явна.
-- =========================================================

-- ---------- Профайл: нэвтрэх нэр, нууцлал ----------
alter table public.profiles
  add column if not exists handle text unique check (handle ~ '^[a-z0-9_.]{3,20}$'),
  -- public: нэрээр хайхад олдоно. friends: зөвхөн @handle эсвэл ID-аар олдож, зураг нь найзад л харагдана
  add column if not exists profile_visibility text not null default 'public' check (profile_visibility in ('public', 'friends')),
  add column if not exists mood_visibility text not null default 'friends' check (mood_visibility in ('everyone', 'friends', 'nobody')),
  add column if not exists message_permission text not null default 'friends' check (message_permission in ('everyone', 'friends', 'nobody')),
  add column if not exists friends_visibility text not null default 'friends' check (friends_visibility in ('everyone', 'friends', 'nobody'));

-- ---------- Найз ----------
create table if not exists public.friendships (
  requester     uuid not null references auth.users (id) on delete cascade,
  addressee     uuid not null references auth.users (id) on delete cascade,
  status        text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  primary key (requester, addressee),
  check (requester <> addressee)
);
-- Нэг хосын хооронд нэг л мөр (аль чиглэлээс илгээсэн нь хамаагүй)
create unique index if not exists friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists friendships_addressee on public.friendships (addressee, status);
alter table public.friendships enable row level security;
drop policy if exists "own friendships" on public.friendships;
create policy "own friendships" on public.friendships
  for select to authenticated using ((select auth.uid()) in (requester, addressee));

-- ---------- Блок ----------
create table if not exists public.blocks (
  blocker     uuid not null references auth.users (id) on delete cascade,
  blocked     uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
alter table public.blocks enable row level security;
drop policy if exists "own blocks" on public.blocks;
create policy "own blocks" on public.blocks for select to authenticated using ((select auth.uid()) = blocker);

-- ---------- Зурвас ----------
create table if not exists public.messages (
  id          bigint generated always as identity primary key,
  sender      uuid not null references auth.users (id) on delete cascade,
  recipient   uuid not null references auth.users (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now(),
  read_at     timestamptz,
  check (sender <> recipient)
);
create index if not exists messages_pair on public.messages (least(sender, recipient), greatest(sender, recipient), created_at);
create index if not exists messages_unread on public.messages (recipient) where read_at is null;
alter table public.messages enable row level security;
drop policy if exists "own messages" on public.messages;
create policy "own messages" on public.messages
  for select to authenticated using ((select auth.uid()) in (sender, recipient));

-- ---------- Туслах функцүүд ----------
create or replace function public.is_friend(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friendships f
    where f.status = 'accepted' and least(f.requester, f.addressee) = least(a, b) and greatest(f.requester, f.addressee) = greatest(a, b));
$$;

create or replace function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks k where (k.blocker = a and k.blocked = b) or (k.blocker = b and k.blocked = a));
$$;

-- Тохиргооны түвшинг (everyone/friends/nobody) тухайн хүнд зөвшөөрөх эсэх
create or replace function public.can_see(level text, viewer uuid, owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select viewer = owner or level = 'everyone' or (level = 'friends' and public.is_friend(viewer, owner));
$$;

-- Хоёр хүний харилцаа: self / friend / outgoing / incoming / none
create or replace function public.relation(viewer uuid, other uuid) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when viewer = other then 'self'
    when public.is_friend(viewer, other) then 'friend'
    when exists (select 1 from public.friendships f where f.requester = viewer and f.addressee = other and f.status = 'pending') then 'outgoing'
    when exists (select 1 from public.friendships f where f.requester = other and f.addressee = viewer and f.status = 'pending') then 'incoming'
    else 'none' end;
$$;

-- Хүний сүүлийн бүртгэлийн mood (харах эрхтэй бол)
create or replace function public.visible_mood(viewer uuid, owner uuid)
returns table (mood text, entry_date date)
language sql stable security definer set search_path = '' as $$
  select e.mood, e.entry_date from public.mood_entries e
  join public.profiles p on p.id = owner
  where e.user_id = owner and public.can_see(p.mood_visibility, viewer, owner)
  order by e.entry_date desc, e.entry_time desc limit 1;
$$;

revoke execute on function public.is_friend(uuid, uuid), public.is_blocked(uuid, uuid), public.can_see(text, uuid, uuid),
  public.relation(uuid, uuid), public.visible_mood(uuid, uuid) from public, anon;

-- ---------- Хайх: нэр, @handle, ID (эхний 8 тэмдэгт ч болно) ----------
create or replace function public.search_users(q text)
returns table (id uuid, name text, handle text, avatar text, relation text)
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid(); t text := lower(trim(q)); h text := ltrim(lower(trim(q)), '@');
begin
  if me is null or char_length(t) < 2 then return; end if;
  return query
  select p.id, p.name, p.handle,
    case when p.profile_visibility = 'public' or public.is_friend(me, p.id) then p.avatar end,
    public.relation(me, p.id)
  from public.profiles p
  where p.id <> me and p.deletion_requested_at is null and not public.is_blocked(me, p.id)
    and (
      p.handle = h or p.id::text like h || '%'
      or ((p.profile_visibility = 'public' or public.is_friend(me, p.id))
          and (p.name ilike '%' || t || '%' or p.handle like h || '%'))
    )
  order by (p.handle = h) desc, public.is_friend(me, p.id) desc, p.name
  limit 20;
end $$;

-- ---------- Хэрэглэгчийн карт ----------
create or replace function public.user_card(target uuid)
returns table (id uuid, name text, handle text, avatar text, relation text, mood text, mood_date date,
               friends_count integer, friends_visible boolean, can_message boolean, is_private boolean)
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null or public.is_blocked(me, target) then return; end if;
  return query
  select p.id, p.name, p.handle,
    case when p.profile_visibility = 'public' or public.is_friend(me, p.id) or me = p.id then p.avatar end,
    public.relation(me, p.id),
    (select v.mood from public.visible_mood(me, p.id) v),
    (select v.entry_date from public.visible_mood(me, p.id) v),
    case when public.can_see(p.friends_visibility, me, p.id)
      then (select count(*)::int from public.friendships f where f.status = 'accepted' and p.id in (f.requester, f.addressee)) end,
    public.can_see(p.friends_visibility, me, p.id),
    me <> p.id and public.can_see(p.message_permission, me, p.id),
    p.profile_visibility = 'friends'
  from public.profiles p
  where p.id = target and p.deletion_requested_at is null;
end $$;

-- Хүний найзуудын жагсаалт (тэр хүн харуулахыг зөвшөөрсөн бол)
create or replace function public.user_friends(target uuid)
returns table (id uuid, name text, handle text, avatar text)
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null or public.is_blocked(me, target) then return; end if;
  if not exists (select 1 from public.profiles p where p.id = target and public.can_see(p.friends_visibility, me, target)) then return; end if;
  return query
  select p.id, p.name, p.handle, case when p.profile_visibility = 'public' or public.is_friend(me, p.id) or p.id = me then p.avatar end
  from public.friendships f
  join public.profiles p on p.id = case when f.requester = target then f.addressee else f.requester end
  where f.status = 'accepted' and target in (f.requester, f.addressee)
    and p.deletion_requested_at is null and not public.is_blocked(me, p.id)
  order by p.name;
end $$;

-- ---------- Миний найзууд: сүүлийн mood, сүүлийн зурвас, уншаагүй ----------
create or replace function public.my_friends()
returns table (id uuid, name text, handle text, avatar text, mood text, mood_date date, last_body text, last_at timestamptz, unread integer)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, p.handle, p.avatar,
    (select v.mood from public.visible_mood(auth.uid(), p.id) v),
    (select v.entry_date from public.visible_mood(auth.uid(), p.id) v),
    lm.body, lm.created_at,
    (select count(*)::int from public.messages m where m.sender = p.id and m.recipient = auth.uid() and m.read_at is null)
  from public.friendships f
  join public.profiles p on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
  left join lateral (
    select m.body, m.created_at from public.messages m
    where (m.sender = auth.uid() and m.recipient = p.id) or (m.sender = p.id and m.recipient = auth.uid())
    order by m.created_at desc limit 1
  ) lm on true
  where f.status = 'accepted' and auth.uid() in (f.requester, f.addressee) and p.deletion_requested_at is null
  order by lm.created_at desc nulls last, p.name;
$$;

-- Найз биш хүмүүстэй (тэд «бүгд бичиж болно» гэсэн бол) хийсэн яриа
create or replace function public.other_chats()
returns table (id uuid, name text, handle text, avatar text, last_body text, last_at timestamptz, unread integer)
language sql stable security definer set search_path = '' as $$
  with partners as (
    select distinct case when m.sender = auth.uid() then m.recipient else m.sender end as pid
    from public.messages m where auth.uid() in (m.sender, m.recipient)
  )
  select p.id, p.name, p.handle, case when p.profile_visibility = 'public' then p.avatar end,
    lm.body, lm.created_at,
    (select count(*)::int from public.messages m where m.sender = p.id and m.recipient = auth.uid() and m.read_at is null)
  from partners x
  join public.profiles p on p.id = x.pid
  left join lateral (
    select m.body, m.created_at from public.messages m
    where (m.sender = auth.uid() and m.recipient = p.id) or (m.sender = p.id and m.recipient = auth.uid())
    order by m.created_at desc limit 1
  ) lm on true
  where not public.is_friend(auth.uid(), p.id) and not public.is_blocked(auth.uid(), p.id) and p.deletion_requested_at is null
  order by lm.created_at desc;
$$;

create or replace function public.friend_requests()
returns table (id uuid, name text, handle text, avatar text, direction text, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, p.handle, case when p.profile_visibility = 'public' then p.avatar end,
    case when f.requester = auth.uid() then 'outgoing' else 'incoming' end, f.created_at
  from public.friendships f
  join public.profiles p on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
  where f.status = 'pending' and auth.uid() in (f.requester, f.addressee) and p.deletion_requested_at is null
  order by f.created_at desc;
$$;

create or replace function public.blocked_users()
returns table (id uuid, name text, handle text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, p.handle from public.blocks k join public.profiles p on p.id = k.blocked
  where k.blocker = auth.uid() order by k.created_at desc;
$$;

create or replace function public.social_counts()
returns table (friends integer, incoming integer, unread integer)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*)::int from public.friendships f where f.status = 'accepted' and auth.uid() in (f.requester, f.addressee)),
    (select count(*)::int from public.friendships f where f.status = 'pending' and f.addressee = auth.uid()),
    (select count(*)::int from public.messages m where m.recipient = auth.uid() and m.read_at is null
       and not public.is_blocked(auth.uid(), m.sender));
$$;

-- ---------- Үйлдлүүд ----------
-- Хүсэлт илгээх. Тэр хүн надад аль хэдийн хүсэлт илгээсэн бол шууд найз болно. Буцаана: шинэ relation
create or replace function public.send_friend_request(target uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  if me is null or target = me then raise exception 'invalid'; end if;
  if public.is_blocked(me, target) then raise exception 'blocked'; end if;
  if not exists (select 1 from public.profiles p where p.id = target and p.deletion_requested_at is null) then raise exception 'not found'; end if;
  if exists (select 1 from public.friendships f where f.requester = target and f.addressee = me and f.status = 'pending') then
    update public.friendships set status = 'accepted', responded_at = now() where requester = target and addressee = me;
    return 'friend';
  end if;
  insert into public.friendships (requester, addressee) values (me, target) on conflict do nothing;
  return public.relation(me, target);
end $$;

create or replace function public.respond_friend_request(from_user uuid, accept boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if accept then
    update public.friendships set status = 'accepted', responded_at = now()
    where requester = from_user and addressee = auth.uid() and status = 'pending';
  else
    delete from public.friendships where requester = from_user and addressee = auth.uid() and status = 'pending';
  end if;
end $$;

-- Найзаас хасах эсвэл илгээсэн хүсэлтээ цуцлах
create or replace function public.remove_friend(target uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.friendships f
  where least(f.requester, f.addressee) = least(auth.uid(), target) and greatest(f.requester, f.addressee) = greatest(auth.uid(), target);
$$;

create or replace function public.block_user(target uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or target = auth.uid() then raise exception 'invalid'; end if;
  insert into public.blocks (blocker, blocked) values (auth.uid(), target) on conflict do nothing;
  perform public.remove_friend(target);
end $$;

create or replace function public.unblock_user(target uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.blocks where blocker = auth.uid() and blocked = target;
$$;

-- Зурвас илгээх: блок, хүлээн авагчийн «хэн бичиж болох» тохиргоог шалгана
create or replace function public.send_message(target uuid, body text) returns public.messages
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); perm text; msg public.messages;
begin
  if me is null or target = me then raise exception 'invalid'; end if;
  if public.is_blocked(me, target) then raise exception 'blocked'; end if;
  select p.message_permission into perm from public.profiles p where p.id = target and p.deletion_requested_at is null;
  if perm is null then raise exception 'not found'; end if;
  if not public.can_see(perm, me, target) then raise exception 'not allowed'; end if;
  insert into public.messages (sender, recipient, body) values (me, target, trim(body)) returning * into msg;
  return msg;
end $$;

create or replace function public.mark_read(from_user uuid) returns void
language sql security definer set search_path = '' as $$
  update public.messages set read_at = now() where sender = from_user and recipient = auth.uid() and read_at is null;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'search_users(text)', 'user_card(uuid)', 'user_friends(uuid)', 'my_friends()', 'other_chats()', 'friend_requests()',
    'blocked_users()', 'social_counts()', 'send_friend_request(uuid)', 'respond_friend_request(uuid, boolean)',
    'remove_friend(uuid)', 'block_user(uuid)', 'unblock_user(uuid)', 'send_message(uuid, text)', 'mark_read(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

grant select on public.friendships, public.blocks, public.messages to authenticated;
grant all on public.friendships, public.blocks, public.messages to service_role;

notify pgrst, 'reload schema';

commit;
