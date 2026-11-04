-- =========================================================
-- 0008: Төлөвлөгөөний цаг, эможи (календарь дээр харагдана)
-- =========================================================

alter table public.todos
  add column if not exists planned_time time,
  add column if not exists emoji text check (char_length(emoji) <= 16);

notify pgrst, 'reload schema';
