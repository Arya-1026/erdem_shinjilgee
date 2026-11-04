import { createBrowserClient } from '@supabase/ssr';

// Браузерийн client. Бүх query RLS-ээр хамгаалагдана: хэрэглэгч зөвхөн өөрийн мөрийг хардаг.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
