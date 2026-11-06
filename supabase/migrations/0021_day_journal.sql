-- =========================================================
-- 0021: Өдрийн тэмдэглэл (өдөрт нэг, ерөнхий сэтгэл санаатай),
--       нэмэлт тэмдэглэл (өдөрт хэд ч байж болно, бүртгэлээс тусдаа)
-- =========================================================

create table if not exists public.day_journals (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  mood        text check (mood in ('happy', 'calm', 'neutral', 'tired', 'anxious', 'sad', 'angry')),
  body        text not null default '' check (char_length(body) <= 5000),
  updated_at  timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.day_journals enable row level security;

create table if not exists public.day_notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day         date not null,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index if not exists day_notes_user_day on public.day_notes (user_id, day);
alter table public.day_notes enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'day_journals' and policyname = 'own day journals') then
    create policy "own day journals" on public.day_journals
      for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'day_notes' and policyname = 'own day notes') then
    create policy "own day notes" on public.day_notes
      for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
end $$;
