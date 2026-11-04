-- =========================================================
-- 0007: Data API-ийн эрх. Шинэ Supabase төслүүд public schema-гийн хүснэгтэд
-- anon/authenticated/service_role-д автоматаар эрх олгохоо больсон
-- ("permission denied for table ..."). Мөр бүрийг RLS хамгаалсаар байна.
-- anon-д эрх өгөхгүй: апп зөвхөн нэвтэрсэн хэрэглэгчид өгөгдөл харуулна.
-- =========================================================

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

-- Цаашид үүсэх хүснэгтэд ч мөн адил
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;

notify pgrst, 'reload schema';
