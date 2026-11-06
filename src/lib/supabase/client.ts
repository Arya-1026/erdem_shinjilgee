import { createBrowserClient } from '@supabase/ssr';
import { AUTH_COOKIE_OPTIONS } from './cookie-options';

// Браузерийн client. Бүх query RLS-ээр хамгаалагдана: хэрэглэгч зөвхөн өөрийн мөрийг хардаг.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookieOptions: AUTH_COOKIE_OPTIONS },
  );
}
