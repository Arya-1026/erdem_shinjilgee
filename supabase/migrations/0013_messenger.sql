-- =========================================================
-- 0013: Messenger шиг үйлдлүүд + хүн бүрээр mood нуух
--  - mood_hidden: тодорхой хүнээс сэтгэл санаагаа нуух (ерөнхий тохиргооноос үл хамааран)
--  - chat_archives: яриаг архивлах (шинэ зурвас ирэхэд дахин гарч ирнэ)
--  - messages.hidden_for_*: «надаас устгах»; илгээгч «бүгдээс буцааж» болно (мөрийг устгана)
-- =========================================================

create table if not exists public.mood_hidden (
  owner       uuid not null references auth.users (id) on delete cascade,
  viewer      uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (owner, viewer)
);
alter table public.mood_hidden enable row level security;
drop policy if exists "own mood hidden" on public.mood_hidden;
create policy "own mood hidden" on public.mood_hidden for select to authenticated using ((select auth.uid()) = owner);

create table if not exists public.chat_archives (
  owner        uuid not null references auth.users (id) on delete cascade,
  partner      uuid not null references auth.users (id) on delete cascade,
  archived_at  timestamptz not null default now(),
  primary key (owner, partner)
);
alter table public.chat_archives enable row level security;
drop policy if exists "own archives" on public.chat_archives;
create policy "own archives" on public.chat_archives for select to authenticated using ((select auth.uid()) = owner);

alter table public.messages
  add column if not exists hidden_for_sender boolean not null default false,
  add column if not exists hidden_for_recipient boolean not null default false;

-- Өөрөөсөө устгасан зурвас харагдахгүй
drop policy if exists "own messages" on public.messages;
create policy "own messages" on public.messages for select to authenticated using (
  ((select auth.uid()) = sender and not hidden_for_sender) or ((select auth.uid()) = recipient and not hidden_for_recipient));

-- Надад харагдах зурвас эсэх
create or replace function public.msg_visible(m public.messages, me uuid) returns boolean
language sql immutable set search_path = '' as $$
  select (m.sender = me and not m.hidden_for_sender) or (m.recipient = me and not m.hidden_for_recipient);
$$;

-- Mood: ерөнхий тохиргоо + тухайн хүнээс нуусан эсэх
create or replace function public.visible_mood(viewer uuid, owner uuid)
returns table (mood text, entry_date date)
language sql stable security definer set search_path = '' as $$
  select e.mood, e.entry_date from public.mood_entries e
  join public.profiles p on p.id = owner
  where e.user_id = owner and public.can_see(p.mood_visibility, viewer, owner)
    -- SQL функцэд баганын нэр параметрээс давуу тул параметрийг функцийн нэрээр нь заана
    and (visible_mood.viewer = visible_mood.owner or not exists (select 1 from public.mood_hidden h where h.owner = visible_mood.owner and h.viewer = visible_mood.viewer))
  order by e.entry_date desc, e.entry_time desc limit 1;
$$;

-- Буцаах багана өөрчлөгдсөн функцүүдийг дахин үүсгэнэ
drop function if exists public.social_counts();
drop function if exists public.my_friends();
drop function if exists public.other_chats();
drop function if exists public.user_card(uuid);

create function public.social_counts()
returns table (friends integer, incoming integer, unread integer, blocked integer)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*)::int from public.friendships f where f.status = 'accepted' and auth.uid() in (f.requester, f.addressee)),
    (select count(*)::int from public.friendships f where f.status = 'pending' and f.addressee = auth.uid()),
    (select count(*)::int from public.messages m where m.recipient = auth.uid() and m.read_at is null and not m.hidden_for_recipient
       and not public.is_blocked(auth.uid(), m.sender)),
    (select count(*)::int from public.blocks k where k.blocker = auth.uid());
$$;

-- Миний яриа: найз эсэх, сүүлийн mood, сүүлийн зурвас, уншаагүй, архивласан эсэх, түүнээс mood нуусан эсэх
create function public.my_friends()
returns table (id uuid, name text, handle text, avatar text, mood text, mood_date date,
               last_body text, last_at timestamptz, last_mine boolean, unread integer, archived boolean, mood_hidden boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, p.handle, p.avatar,
    (select v.mood from public.visible_mood(auth.uid(), p.id) v),
    (select v.entry_date from public.visible_mood(auth.uid(), p.id) v),
    lm.body, lm.created_at, lm.sender = auth.uid(),
    (select count(*)::int from public.messages m where m.sender = p.id and m.recipient = auth.uid() and m.read_at is null and not m.hidden_for_recipient),
    exists (select 1 from public.chat_archives a where a.owner = auth.uid() and a.partner = p.id and (lm.created_at is null or a.archived_at >= lm.created_at)),
    exists (select 1 from public.mood_hidden h where h.owner = auth.uid() and h.viewer = p.id)
  from public.friendships f
  join public.profiles p on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
  left join lateral (
    select m.body, m.created_at, m.sender from public.messages m
    where ((m.sender = auth.uid() and m.recipient = p.id) or (m.sender = p.id and m.recipient = auth.uid())) and public.msg_visible(m, auth.uid())
    order by m.created_at desc limit 1
  ) lm on true
  where f.status = 'accepted' and auth.uid() in (f.requester, f.addressee) and p.deletion_requested_at is null
  order by lm.created_at desc nulls last, p.name;
$$;

create function public.other_chats()
returns table (id uuid, name text, handle text, avatar text, last_body text, last_at timestamptz, last_mine boolean, unread integer, archived boolean)
language sql stable security definer set search_path = '' as $$
  with partners as (
    select distinct case when m.sender = auth.uid() then m.recipient else m.sender end as pid
    from public.messages m where auth.uid() in (m.sender, m.recipient) and public.msg_visible(m, auth.uid())
  )
  select p.id, p.name, p.handle, case when p.profile_visibility = 'public' then p.avatar end,
    lm.body, lm.created_at, lm.sender = auth.uid(),
    (select count(*)::int from public.messages m where m.sender = p.id and m.recipient = auth.uid() and m.read_at is null and not m.hidden_for_recipient),
    exists (select 1 from public.chat_archives a where a.owner = auth.uid() and a.partner = p.id and a.archived_at >= lm.created_at)
  from partners x
  join public.profiles p on p.id = x.pid
  join lateral (
    select m.body, m.created_at, m.sender from public.messages m
    where ((m.sender = auth.uid() and m.recipient = p.id) or (m.sender = p.id and m.recipient = auth.uid())) and public.msg_visible(m, auth.uid())
    order by m.created_at desc limit 1
  ) lm on true
  where not public.is_friend(auth.uid(), p.id) and not public.is_blocked(auth.uid(), p.id) and p.deletion_requested_at is null
  order by lm.created_at desc;
$$;

create function public.user_card(target uuid)
returns table (id uuid, name text, handle text, avatar text, relation text, mood text, mood_date date,
               friends_count integer, friends_visible boolean, can_message boolean, is_private boolean,
               mood_hidden boolean, archived boolean)
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
    p.profile_visibility = 'friends',
    exists (select 1 from public.mood_hidden h where h.owner = me and h.viewer = p.id),
    exists (select 1 from public.chat_archives a where a.owner = me and a.partner = p.id)
  from public.profiles p
  where p.id = target and p.deletion_requested_at is null;
end $$;

-- ---------- Үйлдлүүд ----------
create or replace function public.set_mood_hidden(target uuid, hidden boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or target = auth.uid() then raise exception 'invalid'; end if;
  if hidden then insert into public.mood_hidden (owner, viewer) values (auth.uid(), target) on conflict do nothing;
  else delete from public.mood_hidden where owner = auth.uid() and viewer = target; end if;
end $$;

create or replace function public.set_chat_archived(partner uuid, archived boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'invalid'; end if;
  if archived then
    insert into public.chat_archives (owner, partner) values (auth.uid(), partner)
    on conflict on constraint chat_archives_pkey do update set archived_at = now();
  else delete from public.chat_archives a where a.owner = auth.uid() and a.partner = set_chat_archived.partner; end if;
end $$;

-- Нэг зурвас: for_all = true бол (зөвхөн илгээгч) бүгдээс буцаана, үгүй бол зөвхөн надаас нууна
create or replace function public.delete_message(msg_id bigint, for_all boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); m public.messages;
begin
  select * into m from public.messages where id = msg_id;
  if m.id is null or me not in (m.sender, m.recipient) then raise exception 'not found'; end if;
  if for_all then
    if m.sender <> me then raise exception 'not allowed'; end if;
    delete from public.messages where id = msg_id;
  elsif m.sender = me then update public.messages set hidden_for_sender = true where id = msg_id;
  else update public.messages set hidden_for_recipient = true where id = msg_id;
  end if;
end $$;

-- Ярианы түүхийг бүхэлд нь надаас устгах (нөгөө хүнд хэвээр үлдэнэ)
create or replace function public.delete_chat(partner uuid) returns void
language sql security definer set search_path = '' as $$
  update public.messages set hidden_for_sender = true where sender = auth.uid() and recipient = partner;
  update public.messages set hidden_for_recipient = true, read_at = coalesce(read_at, now()) where recipient = auth.uid() and sender = partner;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'social_counts()', 'my_friends()', 'other_chats()', 'user_card(uuid)',
    'set_mood_hidden(uuid, boolean)', 'set_chat_archived(uuid, boolean)', 'delete_message(bigint, boolean)', 'delete_chat(uuid)'
  ] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.msg_visible(public.messages, uuid) from public, anon;

grant select on public.mood_hidden, public.chat_archives to authenticated;
grant all on public.mood_hidden, public.chat_archives to service_role;

notify pgrst, 'reload schema';
