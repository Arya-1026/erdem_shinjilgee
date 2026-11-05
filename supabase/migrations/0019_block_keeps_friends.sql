-- Блоклоход найзын холбоог устгахгүй: блок цуцлахад найз хэвээр үлдэнэ.
-- Блоклогдсон хооронд найз гэж тооцогдохгүй (is_friend → false), жагсаалт, тоонд харагдахгүй.

create or replace function public.is_friend(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friendships f
    where f.status = 'accepted' and least(f.requester, f.addressee) = least(a, b) and greatest(f.requester, f.addressee) = greatest(a, b))
    and not exists (select 1 from public.blocks k where (k.blocker = a and k.blocked = b) or (k.blocker = b and k.blocked = a));
$$;

-- Хүлээгдэж буй хүсэлтийг л устгана, батлагдсан найзын холбоо үлдэнэ
create or replace function public.block_user(target uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or target = auth.uid() then raise exception 'invalid'; end if;
  insert into public.blocks (blocker, blocked) values (auth.uid(), target) on conflict do nothing;
  delete from public.friendships f
  where f.status = 'pending'
    and least(f.requester, f.addressee) = least(auth.uid(), target) and greatest(f.requester, f.addressee) = greatest(auth.uid(), target);
end $$;

create or replace function public.social_counts()
returns table (friends integer, incoming integer, unread integer, blocked integer)
language sql stable security definer set search_path = '' as $$
  select
    (select count(*)::int from public.friendships f where f.status = 'accepted' and auth.uid() in (f.requester, f.addressee)
       and not public.is_blocked(f.requester, f.addressee)),
    (select count(*)::int from public.friendships f where f.status = 'pending' and f.addressee = auth.uid()),
    (select count(*)::int from public.messages m where m.recipient = auth.uid() and m.read_at is null and not m.hidden_for_recipient
       and not public.is_blocked(auth.uid(), m.sender)),
    (select count(*)::int from public.blocks k where k.blocker = auth.uid());
$$;

create or replace function public.my_friends()
returns table (id uuid, name text, handle text, avatar text, mood text, mood_date date,
               last_body text, last_at timestamptz, last_mine boolean, unread integer, archived boolean,
               mood_hidden boolean, favorite boolean, active_at timestamptz,
               note_text text, note_mood text, note_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, p.handle, p.avatar,
    (select v.mood from public.visible_mood(auth.uid(), p.id) v),
    (select v.entry_date from public.visible_mood(auth.uid(), p.id) v),
    lm.body, lm.created_at, lm.sender = auth.uid(),
    (select count(*)::int from public.messages m where m.sender = p.id and m.recipient = auth.uid() and m.read_at is null and not m.hidden_for_recipient),
    exists (select 1 from public.chat_archives a where a.owner = auth.uid() and a.partner = p.id and (lm.created_at is null or a.archived_at >= lm.created_at)),
    exists (select 1 from public.mood_hidden h where h.owner = auth.uid() and h.viewer = p.id),
    exists (select 1 from public.favorite_friends fv where fv.owner = auth.uid() and fv.friend = p.id),
    -- Би ч, тэр ч идэвхтэй байдлаа харуулдаг бол л
    case when p.show_active and (select me.show_active from public.profiles me where me.id = auth.uid()) then p.last_seen_at end,
    -- Бодол 24 цаг харагдана. Тэр надаас сэтгэл санаагаа нуусан бол эможи нь харагдахгүй.
    case when p.note_at > now() - interval '24 hours' then p.note_text end,
    case when p.note_at > now() - interval '24 hours' and not exists (select 1 from public.mood_hidden h where h.owner = p.id and h.viewer = auth.uid()) then p.note_mood end,
    case when p.note_at > now() - interval '24 hours' then p.note_at end
  from public.friendships f
  join public.profiles p on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
  left join lateral (
    select m.body, m.created_at, m.sender from public.messages m
    where ((m.sender = auth.uid() and m.recipient = p.id) or (m.sender = p.id and m.recipient = auth.uid())) and public.msg_visible(m, auth.uid())
    order by m.created_at desc limit 1
  ) lm on true
  where f.status = 'accepted' and auth.uid() in (f.requester, f.addressee) and p.deletion_requested_at is null
    and not public.is_blocked(auth.uid(), p.id)
  order by exists (select 1 from public.favorite_friends fv where fv.owner = auth.uid() and fv.friend = p.id) desc,
    lm.created_at desc nulls last, p.name;
$$;
