-- Найзын хүсэлт ирэхэд хонх шууд шинэчлэгдэнэ. Realtime нь "own friendships" RLS-ийг дагадаг тул хүн зөвхөн өөрийн мөрийг авна.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'friendships') then
    alter publication supabase_realtime add table public.friendships;
  end if;
end $$;
