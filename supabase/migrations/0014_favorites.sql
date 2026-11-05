-- =========================================================
-- 0014: Дуртай (favorite) найзууд: жагсаалтын дээр ⭐-тэй гарна
-- =========================================================

create table if not exists public.favorite_friends (
  owner       uuid not null references auth.users (id) on delete cascade,
  friend      uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (owner, friend)
);
alter table public.favorite_friends enable row level security;
drop policy if exists "own favorites" on public.favorite_friends;
create policy "own favorites" on public.favorite_friends for select to authenticated using ((select auth.uid()) = owner);

drop function if exists public.my_friends();
create function public.my_friends()
returns table (id uuid, name text, handle text, avatar text, mood text, mood_date date,
               last_body text, last_at timestamptz, last_mine boolean, unread integer, archived boolean, mood_hidden boolean, favorite boolean)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, p.handle, p.avatar,
    (select v.mood from public.visible_mood(auth.uid(), p.id) v),
    (select v.entry_date from public.visible_mood(auth.uid(), p.id) v),
    lm.body, lm.created_at, lm.sender = auth.uid(),
    (select count(*)::int from public.messages m where m.sender = p.id and m.recipient = auth.uid() and m.read_at is null and not m.hidden_for_recipient),
    exists (select 1 from public.chat_archives a where a.owner = auth.uid() and a.partner = p.id and (lm.created_at is null or a.archived_at >= lm.created_at)),
    exists (select 1 from public.mood_hidden h where h.owner = auth.uid() and h.viewer = p.id),
    exists (select 1 from public.favorite_friends fv where fv.owner = auth.uid() and fv.friend = p.id)
  from public.friendships f
  join public.profiles p on p.id = case when f.requester = auth.uid() then f.addressee else f.requester end
  left join lateral (
    select m.body, m.created_at, m.sender from public.messages m
    where ((m.sender = auth.uid() and m.recipient = p.id) or (m.sender = p.id and m.recipient = auth.uid())) and public.msg_visible(m, auth.uid())
    order by m.created_at desc limit 1
  ) lm on true
  where f.status = 'accepted' and auth.uid() in (f.requester, f.addressee) and p.deletion_requested_at is null
  order by exists (select 1 from public.favorite_friends fv where fv.owner = auth.uid() and fv.friend = p.id) desc,
    lm.created_at desc nulls last, p.name;
$$;

-- Зөвхөн найзыг favorite болгоно
create or replace function public.set_favorite(target uuid, favorite boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if favorite then
    if not public.is_friend(auth.uid(), target) then raise exception 'not allowed'; end if;
    insert into public.favorite_friends (owner, friend) values (auth.uid(), target) on conflict do nothing;
  else delete from public.favorite_friends where owner = auth.uid() and friend = target; end if;
end $$;

-- Найзаас хасахад favorite-оос ч хасна
create or replace function public.remove_friend(target uuid) returns void
language sql security definer set search_path = '' as $$
  delete from public.friendships f
  where least(f.requester, f.addressee) = least(auth.uid(), target) and greatest(f.requester, f.addressee) = greatest(auth.uid(), target);
  delete from public.favorite_friends where (owner = auth.uid() and friend = target) or (owner = target and friend = auth.uid());
$$;

revoke execute on function public.my_friends(), public.set_favorite(uuid, boolean) from public, anon;
grant execute on function public.my_friends(), public.set_favorite(uuid, boolean) to authenticated;
grant select on public.favorite_friends to authenticated;
grant all on public.favorite_friends to service_role;

notify pgrst, 'reload schema';
