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
