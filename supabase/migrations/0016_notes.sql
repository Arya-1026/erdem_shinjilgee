-- =========================================================
-- 0016: Бодол (Messenger-ийн Note шиг): найзуудын эгнээнд аватарын дээр
-- 60 тэмдэгт хүртэлх бичвэр + одоогийн сэтгэл санааны эможи. 24 цагийн дараа алга болно.
-- =========================================================

alter table public.profiles
  add column if not exists note_text text,
  add column if not exists note_mood text,
  add column if not exists note_at timestamptz;

alter table public.profiles drop constraint if exists profiles_note_text_len;
alter table public.profiles add constraint profiles_note_text_len check (char_length(note_text) <= 60);
alter table public.profiles drop constraint if exists profiles_note_mood_check;
alter table public.profiles add constraint profiles_note_mood_check
  check (note_mood in ('happy', 'calm', 'neutral', 'tired', 'anxious', 'sad', 'angry'));

drop function if exists public.my_friends();
create function public.my_friends()
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
  order by exists (select 1 from public.favorite_friends fv where fv.owner = auth.uid() and fv.friend = p.id) desc,
    lm.created_at desc nulls last, p.name;
$$;

revoke execute on function public.my_friends() from public, anon;
grant execute on function public.my_friends() to authenticated;

notify pgrst, 'reload schema';
