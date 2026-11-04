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
