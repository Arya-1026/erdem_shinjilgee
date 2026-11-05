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
