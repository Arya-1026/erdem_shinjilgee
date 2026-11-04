import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Server Component, Route Handler-т ашиглана. cookies() уншдаг тул <Suspense> дотор дуудна.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: cookiesToSet => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Component-оос cookie бичих боломжгүй. Session-ийг proxy.ts шинэчилнэ.
          }
        },
      },
    },
  );
}

// RLS-ийг тойрдог client: зөвхөн cron болон бүртгэл устгахад. Клиент рүү ХЭЗЭЭ Ч бүү гарга.
export function createServiceClient() {
  return createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
