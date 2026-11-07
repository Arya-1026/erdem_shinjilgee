-- =========================================================
-- 0024: DASS-21-ийг 14 хоногт нэг удаа бөглөнө (src/lib/dass.ts → DASS_RETAKE_DAYS).
-- Апп дээр товч идэвхгүй болдог ч хүсэлтийг шууд илгээж тойрохоос сэргийлнэ.
-- =========================================================
create or replace function public.dass_interval() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (
    select 1 from public.dass_results
    where user_id = new.user_id and created_at > now() - interval '14 days'
  ) then
    raise exception 'dass_interval: DASS-21 can be taken once every 14 days' using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace trigger dass_interval
  before insert on public.dass_results
  for each row execute function public.dass_interval();
