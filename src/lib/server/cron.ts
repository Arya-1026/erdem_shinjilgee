import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';

/** pg_cron-ийн дуудлага эсэхийг шалгана: .env-ийн CRON_SECRET эсвэл Vault-д хадгалсан cron_secret (0022_reminder_cron.sql) */
export async function cronAuthorized(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
  if (!token) return false;
  if (process.env.CRON_SECRET && token === process.env.CRON_SECRET) return true;
  const { data } = await createServiceClient().rpc('cron_token_ok', { token });
  return data === true;
}
