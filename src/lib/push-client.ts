/* Web Push: энэ төхөөрөмжийг мэдэгдэл хүлээн авахаар бүртгэх (зөвхөн браузерт) */
import type { SupabaseClient } from '@supabase/supabase-js';

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);

function keyBytes(base64url: string) {
  const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function subscribePush(supabase: SupabaseClient): Promise<'ok' | 'denied' | 'unsupported' | 'error'> {
  if (!pushSupported()) return 'unsupported';
  if ((await Notification.requestPermission()) !== 'granted') return 'denied';
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    });
    const j = sub.toJSON();
    const { error } = await supabase.from('push_subscriptions').upsert({ endpoint: sub.endpoint, p256dh: j.keys!.p256dh, auth: j.keys!.auth });
    return error ? 'error' : 'ok';
  } catch {
    return 'error';
  }
}

export async function unsubscribePush(supabase: SupabaseClient) {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

/** Энэ төхөөрөмж дээр шууд мэдэгдэл харуулна (сервергүй). Зөвшөөрөл байхгүй бол юу ч хийхгүй. */
export async function showLocal(title: string, body: string, tag: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const reg = await navigator.serviceWorker?.getRegistration('/');
  const opts = { body, tag, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: '/home' } };
  if (reg) await reg.showNotification(title, opts);
  else new Notification(title, opts);
}
