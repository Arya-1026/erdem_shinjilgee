-- =========================================================
-- Сануулга: production дээр pg_cron 5 минут тутамд /api/cron/reminders-ийг дуудна.
-- Нууц токеныг өгөгдлийн сан өөрөө үүсгэж Vault-д хадгална, апп үүнийг cron_token_ok()-оор шалгана.
-- Тиймээс Vercel-д CRON_SECRET оруулах шаардлагагүй. Дахин ажиллуулж болно.
-- Өөр хаягт deploy хийвэл доорх app_url-ыг солино.
-- =========================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare url_id uuid;
begin
  select id into url_id from vault.secrets where name = 'app_url';
  if url_id is null then perform vault.create_secret('https://mt-mood.vercel.app', 'app_url');
  else perform vault.update_secret(url_id, 'https://mt-mood.vercel.app');
  end if;
  if not exists (select 1 from vault.secrets where name = 'cron_secret') then
    perform vault.create_secret(gen_random_uuid()::text || gen_random_uuid()::text, 'cron_secret');
  end if;
end $$;

create or replace function public.cron_token_ok(token text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from vault.decrypted_secrets where name = 'cron_secret' and decrypted_secret = token);
$$;
revoke execute on function public.cron_token_ok(text) from public, anon, authenticated;
grant execute on function public.cron_token_ok(text) to service_role;

select cron.schedule(
  'mood-reminders',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/cron/reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $job$
);
