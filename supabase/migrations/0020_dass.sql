-- =========================================================
-- 0020: DASS-21 сэтгэл зүйн асуулга (Гутрал, Түгшүүр, Стресс). Скрининг, онош биш.
-- Хариулт зөвхөн эзэндээ харагдана (найзуудад харагдахгүй).
-- research_consent: нэр нь үл мэдэгдэх байдлаар судалгаанд ашиглахыг зөвшөөрсөн эсэх.
-- =========================================================
create table if not exists public.dass_results (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  answers           smallint[] not null check (array_length(answers, 1) = 21 and 0 <= all (answers) and 3 >= all (answers)),
  depression        smallint not null check (depression between 0 and 42),
  anxiety           smallint not null check (anxiety between 0 and 42),
  stress            smallint not null check (stress between 0 and 42),
  research_consent  boolean not null default false,
  created_at        timestamptz not null default now()
);
create index if not exists dass_results_user_idx on public.dass_results (user_id, created_at desc);

alter table public.dass_results enable row level security;
drop policy if exists "own dass" on public.dass_results;
create policy "own dass" on public.dass_results
  for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
grant select, insert, delete on public.dass_results to authenticated;

notify pgrst, 'reload schema';
