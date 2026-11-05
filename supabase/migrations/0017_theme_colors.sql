-- =========================================================
-- 0017: Апп-ын өнгө: градиент, гүн тод, өөрийн өнгө (custom:#rrggbb эсвэл custom:#rrggbb:#rrggbb)
-- =========================================================
alter table public.profiles drop constraint if exists profiles_theme_check;
alter table public.profiles add constraint profiles_theme_check
  check (theme ~ '^([a-z]{3,20}|custom:#[0-9a-f]{6}(:#[0-9a-f]{6})?)$');
