import type { CookieOptionsWithName } from '@supabase/ssr';

// Нэвтрэлтийн cookie-г хөтөч хаагдсан ч устгахгүй байлгах тохиргоо (утас, PWA дээр дахин нэвтрэхгүй).
// maxAge байхгүй cookie нь "session cookie" болж хөтөч хаагдахад устдаг. 400 хоног бол хөтчийн зөвшөөрөх дээд хязгаар
// (Chrome, RFC 6265bis) бөгөөд Supabase refresh token хугацаагүй тул session-ийг үүгээр хязгаарлахгүй.
// @supabase/ssr ч мөн адил утгыг өгдөг: энд тодорхой бичсэнээр сан шинэчлэгдсэн ч өөрчлөгдөхгүй.
export const AUTH_COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

export const AUTH_COOKIE_OPTIONS: CookieOptionsWithName = {
  path: '/',
  // lax: Google OAuth-оос буцаж ирэх (top-level GET) үед cookie илгээгдэнэ
  sameSite: 'lax',
  maxAge: AUTH_COOKIE_MAX_AGE,
};
