import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { proxy } from './proxy';

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getClaims: async () => ({ data: { claims: { sub: 'u' } } }) } }),
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
