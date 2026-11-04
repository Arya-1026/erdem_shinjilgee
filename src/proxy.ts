import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Хүсэлт бүрт Supabase session-ийг шинэчилж, нэвтрээгүй хэрэглэгчийг /login руу шилжүүлнэ.
// Энэ нь зөвхөн UX-ийн шалгалт. Өгөгдлийн жинхэнэ хамгаалалт бол RLS.
const PUBLIC = ['/login', '/auth', '/setup'];

export async function proxy(request: NextRequest) {
  // .env.local-д Supabase-ийн түлхүүр алга бол бүх хуудсыг тохиргооны заавар руу шилжүүлнэ
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    if (request.nextUrl.pathname === '/setup') return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = '/setup';
    url.search = '';
    return NextResponse.redirect(url);
  }
  if (request.nextUrl.pathname === '/setup') return NextResponse.redirect(new URL('/home', request.url));

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some(p => path === p || path.startsWith(p + '/'));

  if (!data?.claims && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  if (data?.claims && path === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/home';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // API (өөрсдөө auth шалгадаг), статик файл, PWA (manifest, service worker)-ийг алгасна
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
