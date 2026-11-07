import { beforeEach, describe, expect, it, vi } from 'vitest';

/* song_cache-ийг санах ойд дуурайна */
type Row = { query_key: string; found: boolean; cached_at: string; video_id?: string; title?: string; channel?: string; thumbnail?: string | null; duration_s?: number };
let cache: Row[] = [];
const fakeDb = {
  from: () => ({
    select: () => ({
      like: async (_c: string, pattern: string) => ({ data: cache.filter(r => r.query_key.startsWith(pattern.slice(0, -1))) }),
      eq: (_c: string, key: string) => ({ maybeSingle: async () => ({ data: cache.find(r => r.query_key === key) ?? null }) }),
    }),
    delete: () => ({ like: async (_c: string, pattern: string) => { cache = cache.filter(r => !r.query_key.startsWith(pattern.slice(0, -1))); return {}; } }),
    upsert: async (rows: Row | Row[]) => {
      for (const r of [rows].flat()) cache = [...cache.filter(x => x.query_key !== r.query_key), r];
      return {};
    },
  }),
};
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => fakeDb }));
vi.mock('./llm', () => ({ llmConfigured: () => false, llmChat: vi.fn() }));

const track = (id: string, name: string, artist = 'A') => ({ id, name, uri: `spotify:track:${id}`, duration_ms: 1000, artists: [{ id: 'art', name: artist }] });
const json = (body: unknown, init?: ResponseInit) => new Response(JSON.stringify(body), init);
const days = (n: number) => new Date(Date.now() - n * 864e5).toISOString();
const searchCalls = (f: ReturnType<typeof vi.fn>) => f.mock.calls.filter(c => String(c[0]).includes('/search?')).map(c => decodeURIComponent(String(c[0])).replace(/\+/g, ' '));

function mockSpotify(onSearch: (url: string) => Response) {
  const f = vi.fn(async (url: string | URL | Request) => {
    const u = String(url);
    return u.includes('accounts.spotify.com') ? json({ access_token: 't', expires_in: 3600 }) : onSearch(u);
  });
  vi.stubGlobal('fetch', f);
  return f;
}

async function load() {
  vi.resetModules(); // lockedUntil, апп-ын токен нь модулийн төлөв
  return import('./spotify-search');
}

describe('spotify-search', () => {
  beforeEach(() => {
    cache = [];
    process.env.SPOTIFY_CLIENT_ID = 'id';
    process.env.SPOTIFY_CLIENT_SECRET = 'secret';
  });

  it('хязгаар дууссан уран бүтээлчийг «олдсонгүй» гэж хадгалахгүй', async () => {
    const f = mockSpotify(() => json({ artists: { items: [] }, tracks: { items: [] } }));
    const { artistSongs } = await load();
    expect(await artistSongs('Хурд', [], { left: 0 })).toEqual([]);
    expect(cache).toEqual([]);
    expect(searchCalls(f)).toEqual([]);
  });

  it('жинхэнэ «олдсонгүй» хариу 3 хоногийн дараа дахин шалгагдана', async () => {
    const f = mockSpotify(() => json({ artists: { items: [] } }));
    const { artistSongs } = await load();
    cache = [{ query_key: 'spartist:хурд:0', found: false, cached_at: days(2) }];
    await artistSongs('Хурд', [], { left: 1 });
    expect(searchCalls(f)).toEqual([]);
    cache = [{ query_key: 'spartist:хурд:0', found: false, cached_at: days(4) }];
    await artistSongs('Хурд', [], { left: 1 });
    expect(searchCalls(f).length).toBeGreaterThan(0);
  });

  it('урт Retry-After дээр хүлээхгүй, дараагийн хайлтууд Spotify руу явахгүй', async () => {
    const f = mockSpotify(() => json({}, { status: 429, headers: { 'retry-after': '74854' } }));
    const { searchSongs, QuotaExceeded } = await load();
    const started = Date.now();
    await expect(searchSongs('abc')).rejects.toBeInstanceOf(QuotaExceeded);
    await expect(searchSongs('def')).rejects.toBeInstanceOf(QuotaExceeded);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(searchCalls(f)).toHaveLength(1);
  });

  it('квот дууссан ч хугацаа нь өнгөрсөн cache-ээс дуу өгнө', async () => {
    mockSpotify(() => json({}, { status: 429, headers: { 'retry-after': '74854' } }));
    const { genreSongs } = await load();
    cache = [{ query_key: 'spgenre:pop:0', found: true, video_id: 'x', title: 'Old', channel: 'A', thumbnail: null, duration_s: 1, cached_at: days(40) }];
    expect((await genreSongs('pop', { left: 5 })).map(s => s.title)).toEqual(['Old']);
    expect(cache).toHaveLength(1);
  });

  it('төрлийн санг genre шүүлтээр хайж, нийтэд 30 хоног хадгална', async () => {
    const f = mockSpotify(u => json({ tracks: { items: u.includes('offset=0') ? [track('a', 'One'), track('b', 'Two')] : [track('a', 'One'), track('c', 'Three')] } }));
    const { genreSongs } = await load();
    const budget = { left: 5 };
    expect((await genreSongs('hip hop', budget)).map(s => s.title)).toEqual(['One', 'Two', 'Three']);
    expect(budget.left).toBe(4);
    expect(searchCalls(f).every(u => u.includes('q=genre:"hip hop"'))).toBe(true);
    const calls = searchCalls(f).length;
    expect(await genreSongs('hip hop', budget)).toHaveLength(3);
    expect(searchCalls(f)).toHaveLength(calls);
    cache = cache.map(r => ({ ...r, cached_at: days(29) }));
    await genreSongs('hip hop', budget);
    expect(searchCalls(f)).toHaveLength(calls);
  });

  it('шинэчлэхэд богино болсон жагсаалтын хуучин мөр үлдэхгүй', async () => {
    mockSpotify(() => json({ tracks: { items: [track('a', 'One')] } }));
    const { genreSongs } = await load();
    cache = ['0', '1', '2'].map(i => ({ query_key: `spgenre:pop:${i}`, found: true, video_id: i, title: `Old ${i}`, channel: 'A', thumbnail: null, duration_s: 1, cached_at: days(40) }));
    expect((await genreSongs('pop', { left: 5 })).map(s => s.title)).toEqual(['One']);
    expect(cache.map(r => r.query_key)).toEqual(['spgenre:pop:0']);
  });

  it('нэр нь таарахгүй дууг санал болгосон нэрээр нь өгөхгүй', async () => {
    mockSpotify(() => json({ tracks: { items: [track('x1', 'Rich Mongol', 'MagGod')] } }));
    const { findSong } = await load();
    expect(await findSong('Hanggai', 'Mongolian Horsehead Fiddle', { ambient: true })).toBeNull();
    expect(await findSong('MagGod', 'Other Song')).toBeNull();
    expect(cache.find(r => r.query_key.startsWith('sp2:hanggai'))?.found).toBe(false);
  });

  it('нэр, уран бүтээлч таарсан дууг олно, ая бол уран бүтээлч өөр ч болно', async () => {
    mockSpotify(() => json({ tracks: { items: [track('w1', 'Weightless (Remastered)', 'Marconi Union'), track('w2', 'Nuvole Bianche', 'Ludovico Einaudi')] } }));
    const { findSong } = await load();
    expect((await findSong('Marconi Union', 'Weightless'))?.video_id).toBe('w1');
    expect((await findSong('Calm Radio', 'Nuvole Bianche', { ambient: true }))?.video_id).toBe('w2');
  });
});
