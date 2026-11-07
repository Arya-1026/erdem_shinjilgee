-- =========================================================
-- 0025: Хэрэглэгчийн өөрөө нэмсэн хобби аль ангилалд хамаарах ({"Укулеле": "Хөгжим", ...}).
-- hobbies массив хэвээр (нэр л хадгална) тул бусад хэсэг өөрчлөгдөхгүй.
-- =========================================================

alter table public.profiles
  add column if not exists hobby_cats jsonb not null default '{}' check (jsonb_typeof(hobby_cats) = 'object' and pg_column_size(hobby_cats) < 20000);

notify pgrst, 'reload schema';
