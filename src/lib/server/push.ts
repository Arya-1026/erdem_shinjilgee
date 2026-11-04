import 'server-only';
import webpush from 'web-push';
import { createServiceClient } from '@/lib/supabase/server';

export const pushConfigured = () => Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

type Payload = { title: string; body: string; url?: string; tag?: string };

/** Хэрэглэгчдийн бүх төхөөрөмж рүү push илгээнэ. Хүчингүй болсон subscription-ийг устгана. */
export async function sendPush(userIds: string[], payload: Payload) {
  if (!pushConfigured() || !userIds.length) return { sent: 0 };
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const db = createServiceClient();
  const { data: subs } = await db.from('push_subscriptions').select('endpoint,p256dh,auth').in('user_id', userIds);
  let sent = 0;
  const gone: string[] = [];
  await Promise.all((subs ?? []).map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) gone.push(s.endpoint);
      else console.error('[push]', code, e);
    }
  }));
  if (gone.length) await db.from('push_subscriptions').delete().in('endpoint', gone);
  return { sent };
}
