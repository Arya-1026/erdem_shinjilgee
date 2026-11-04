-- =========================================================
-- 30 хоног нэвтрээгүй, устгах хүсэлттэй бүртгэлийг өдөр бүр 03:00 (UTC) бүрмөсөн устгана.
-- 0002_cron.sql-ийн адил Vault-д app_url, cron_secret хадгалсны дараа ажиллуулна.
-- =========================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'purge-deleted-accounts',
  '0 3 * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/cron/purge-accounts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
