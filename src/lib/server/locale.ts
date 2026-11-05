import 'server-only';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, translator } from '@/lib/i18n';

/** Хүсэлтийн хэл (cookie). Server Component-д <Suspense> дотор, Route Handler-т шууд дуудна. */
export async function requestLocale() {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
}

export async function requestT() {
  return translator(await requestLocale());
}
