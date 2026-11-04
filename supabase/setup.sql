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

commit;
