-- =========================================================
-- Өдөр тутмын сануулга: pg_cron 5 минут тутамд /api/cron/reminders-ийг дуудна.
--
-- Ажиллуулахаас ӨМНӨ Supabase SQL Editor дээр Vault-д 2 нууц хадгална:
--   select vault.create_secret('https://your-app.vercel.app', 'app_url');
--   select vault.create_secret('<.env дэх CRON_SECRET>',     'cron_secret');
-- =========================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'mood-reminders',
  '*/5 * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/cron/reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);
