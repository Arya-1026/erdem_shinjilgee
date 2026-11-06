import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { proxy } from './proxy';

// refresh: getClaims дуудагдахад Supabase токен шинэчилснийг дуурайж setAll-ийг дуудна
const supa = vi.hoisted(() => ({ refresh: null as null | { name: string; value: string }, options: undefined as unknown }));
vi.mock('@supabase/ssr', () => ({
  createServerClient: (_url: string, _key: string, opts: {
    cookieOptions?: Record<string, unknown>;
    cookies: { setAll: (c: { name: string; value: string; options: Record<string, unknown> }[], h: Record<string, string>) => void };
  }) => {
    supa.options = opts.cookieOptions;
    return {
      auth: {
        getClaims: async () => {
          // @supabase/ssr-ийн setItem: cookieOptions дээр maxAge-ийг 400 хоногоор тавьдаг
          if (supa.refresh) opts.cookies.setAll([{ ...supa.refresh, options: { ...opts.cookieOptions, maxAge: 400 * 24 * 60 * 60 } }], {});
          return { data: { claims: { sub: 'u' } } };
        },
      },
    };
  },
}));

const request = (url: string, host: string) => new NextRequest(url, { headers: { host } });

describe('JWT хүчинтэй хэрэглэгч /login нээх', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://127.0.0.1:3000');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://supabase.test');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'key');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('ердийн үед /home руу шилжинэ', async () => {
    const res = await proxy(request('http://127.0.0.1:3000/login', '127.0.0.1:3000'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/home');
  });

  it('session цуцлагдсан үед (reauth) нэвтрэх хуудсанд үлдэж, эргэлдэхгүй', async () => {
    const res = await proxy(request('http://127.0.0.1:3000/login?reauth=1', '127.0.0.1:3000'));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });
});

describe('localhost-оос 127.0.0.1 рүү шилжүүлэх', () => {
  beforeEach(() => vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://127.0.0.1:3000'));
  afterEach(() => vi.unstubAllEnvs());

  it('Location ашиглахгүй: Next.js түүнийг /login болгож эргэлдүүлдэг', async () => {
    const res = await proxy(request('http://localhost:3000/login?next=%2Fhome', 'localhost:3000'));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
    expect(res.headers.get('refresh')).toBe('0;url=http://127.0.0.1:3000/login?next=%2Fhome');
    expect(await res.text()).toContain('http://127.0.0.1:3000/login?next=%2Fhome');
  });

  it('хаягийн тусгай тэмдэгтийг HTML-д кодолно', async () => {
    const res = await proxy(request('http://localhost:3000/login?x="><script>', 'localhost:3000'));
    expect(await res.text()).not.toContain('<script>');
  });

  it('127.0.0.1-ээс шилжүүлэхгүй', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    const res = await proxy(request('http://127.0.0.1:3000/setup', '127.0.0.1:3000'));
    expect(res.headers.get('refresh')).toBeNull();
  });
});

describe('нэвтрэлтийн cookie хөтөч хаагдсан ч хадгалагдана', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://127.0.0.1:3000');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://supabase.test');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'key');
  });
  afterEach(() => { vi.unstubAllEnvs(); supa.refresh = null; });

  it('Supabase client-д урт хугацаатай cookie тохиргоо өгнө', async () => {
    await proxy(request('http://127.0.0.1:3000/home', '127.0.0.1:3000'));
    expect(supa.options).toMatchObject({ path: '/', sameSite: 'lax', maxAge: 400 * 24 * 60 * 60 });
  });

  it('токен шинэчлэхэд Set-Cookie нь Max-Age, Expires-тай (session cookie биш)', async () => {
    supa.refresh = { name: 'sb-x-auth-token', value: 'new' };
    const res = await proxy(request('http://127.0.0.1:3000/home', '127.0.0.1:3000'));
    const set = res.headers.get('set-cookie') ?? '';
    expect(set).toContain('sb-x-auth-token=new');
    expect(set).toMatch(/Max-Age=34560000/i);
    expect(set).toMatch(/Expires=/i);
    expect(set).toMatch(/SameSite=lax/i);
    expect(set).toMatch(/Path=\//);
  });
});
