// Локал болон өөрийн сервер дээр сануулгыг 5 минут тутамд шалгана. Supabase-ийн pg_cron нь
// localhost руу хандаж чадахгүй тул энэгүйгээр сануулга хэзээ ч илгээгдэхгүй. Vercel дээр 0002_cron.sql ажиллана.
export function register() {
  const secret = process.env.CRON_SECRET;
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.VERCEL || !secret) return;
  const url = `http://127.0.0.1:${process.env.PORT || 3000}/api/cron/reminders`;
  const tick = () => { fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${secret}` } }).catch(() => {}); };
  setInterval(tick, 5 * 60_000).unref();
}
