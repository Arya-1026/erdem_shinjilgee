/* Нэг төхөөрөмж дээр акаунт солиход өмнөх хэрэглэгчийн өгөгдөл үлдэхгүй байх.
   Cache Components горимд Next.js гарсан хуудсыг <Activity>-оор нууж хадгалдаг тул
   client state (useState), модулийн кэш, router-ийн кэш бүгд дараагийн хэрэглэгчид харагдаж болно.
   Иймээс гарахдаа хуудсыг бүтэн дахин ачаалж, хэрэглэгчийн хувийн localStorage түлхүүрүүдийг устгана. */
import type { SupabaseClient } from '@supabase/supabase-js';
import { unsubscribePush } from './push-client';

/** Тухайн хэрэглэгчийнх (өөр хүнд харагдах ёсгүй). Өнгө, дуу, амьтан зэрэг төхөөрөмжийн тохиргоо энд орохгүй. */
export const USER_STORAGE_KEYS = [
  'setgel-dass-progress', // DASS-21-ийн дуусаагүй хариулт
  'setgel-dass-snooze',
  'setgel_watched', // үзсэн кинонууд
  'setgel_seen_notices', // уншсан мэдэгдлүүд
  'setgel_reminded',
] as const;

export function clearUserStorage() {
  for (const k of USER_STORAGE_KEYS) {
    try { localStorage.removeItem(k); } catch { /* хувийн цонх, хаалттай storage */ }
  }
}

/** Гараад нэвтрэх хуудсыг бүтэн дахин ачаална (санах ой, router-ийн кэш бүрэн цэвэрлэгдэнэ).
    Эхлээд энэ төхөөрөмжийн push мэдэгдлийг цуцална: үгүй бол өмнөх хэрэглэгчийн сануулга дараагийн хүнд ирсээр байна.
    Сервер дээрх бүртгэлийг устгахад нэвтэрсэн байх шаардлагатай тул signOut-оос өмнө хийнэ. */
export async function signOutAndReload(supabase: SupabaseClient, to = '/login') {
  await unsubscribePush(supabase).catch(() => {});
  await supabase.auth.signOut().catch(() => {});
  clearUserStorage();
  window.location.replace(to);
}
