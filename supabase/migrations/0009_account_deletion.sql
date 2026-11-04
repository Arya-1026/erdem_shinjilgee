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
