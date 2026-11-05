-- =========================================================
-- 0011: Профайл зураг. Хөтөч дээр 256px болгож багасгасан data URL (~20–40KB).
-- =========================================================

alter table public.profiles
  add column if not exists avatar text check (avatar is null or (avatar like 'data:image/%' and char_length(avatar) < 200000));

notify pgrst, 'reload schema';
