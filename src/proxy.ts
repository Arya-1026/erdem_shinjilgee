import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE_OPTIONS } from '@/lib/supabase/cookie-options';

// Хүсэлт бүрт Supabase session-ийг шинэчилж, нэвтрээгүй хэрэглэгчийг /login руу шилжүүлнэ.
// Энэ нь зөвхөн UX-ийн шалгалт. Өгөгдлийн жинхэнэ хамгаалалт бол RLS.
const PUBLIC = ['/login', '/auth', '/setup', '/privacy', '/terms'];

export async function proxy(request: NextRequest) {
  // Spotify localhost-ийг зөвшөөрдөггүй, session cookie ч хаяг бүрт тусдаа тул локалд нэг л хаягаар ажиллана
  const app = process.env.NEXT_PUBLIC_APP_URL;
  const host = request.headers.get('host') ?? '';
  if (app && host.startsWith('localhost') && new URL(app).hostname === '127.0.0.1') {
    // Location ашиглаж болохгүй: Next.js 127.0.0.1-ийг localhost-той ижил гэж үзээд /login болгож хувиргадаг тул
    // хөтөч localhost дээрээ эргэлддэг (ERR_TOO_MANY_REDIRECTS). URL.href нь < > " тэмдэгтийг кодолдог тул HTML-д аюулгүй.
    const to = new URL(request.nextUrl.pathname + request.nextUrl.search, app).href;
    return new Response(`<!doctype html><meta http-equiv="refresh" content="0;url=${to}"><a href="${to}">${to}</a>`, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', Refresh: `0;url=${to}`, 'Cache-Control': 'no-store' },
    });
  }

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
      cookieOptions: AUTH_COOKIE_OPTIONS,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet, headers) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          // options (maxAge г.м.)-ийг заавал дамжуулна: үгүй бол шинэчилсэн токен session cookie болж хөтөч хаагдахад устна
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
  // reauth: сервер session-ийг хүчингүй гэж үзсэн (lib/server/dal.ts) тул JWT хүчинтэй ч нэвтрэх хуудсыг харуулна
  if (data?.claims && path === '/login' && !request.nextUrl.searchParams.has('reauth')) {
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
