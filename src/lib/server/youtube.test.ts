import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = { query_key: string; found: boolean; video_id?: string; cached_at: string };
let cache: Row[] = [];
const fakeDb = {
  from: () => ({
    select: () => ({ eq: (_c: string, key: string) => ({ maybeSingle: async () => ({ data: cache.find(r => r.query_key === key) ?? null }) }) }),
    upsert: async (r: Row) => { cache = [...cache.filter(x => x.query_key !== r.query_key), r]; return {}; },
  }),
};
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => fakeDb }));

const days = (n: number) => new Date(Date.now() - n * 864e5).toISOString();
const item = (id: string, title: string, channelTitle = 'X') => ({ id: { videoId: id }, snippet: { title, channelTitle } });
const mockSearch = (make: () => Response) => { const f = vi.fn(async () => make()); vi.stubGlobal('fetch', f); return f; };

async function load() {
  vi.resetModules(); // lockedUntil нь модулийн төлөв
  return import('./youtube');
}

describe('findVideo', () => {
  beforeEach(() => { cache = []; process.env.YOUTUBE_API_KEY = 'k'; });

  it('хайж, олдсоныг нийтэд хадгалаад дараа нь квот зарцуулахгүй', async () => {
    const f = mockSearch(() => Response.json({ items: [item('abc', 'Adele - Easy On Me')] }));
    const { findVideo } = await load();
    expect(await findVideo('Adele', 'Easy On Me')).toBe('abc');
    expect(await findVideo('Adele', 'Easy On Me')).toBe('abc');
    expect(f).toHaveBeenCalledTimes(1);
    expect(cache[0]).toMatchObject({ query_key: 'yt:adele easy on me', found: true, video_id: 'abc' });
  });

  it('олдоогүй хариуг 30 хоног хадгалж, дараа нь дахин хайна', async () => {
    const f = mockSearch(() => Response.json({ items: [] }));
    const { findVideo } = await load();
    expect(await findVideo('A', 'B')).toBeNull();
    expect(await findVideo('A', 'B')).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
    cache = cache.map(r => ({ ...r, cached_at: days(31) }));
    await findVideo('A', 'B');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it.each([403, 429])('квот дуусвал (%i) «олдсонгүй» гэж хадгалахгүй, түр хугацаанд хайхгүй', async status => {
    const f = mockSearch(() => new Response('{}', { status }));
    const { findVideo } = await load();
    expect(await findVideo('A', 'B')).toBeNull();
    expect(await findVideo('C', 'D')).toBeNull();
    expect(f).toHaveBeenCalledTimes(1);
    expect(cache).toEqual([]);
  });

  it('түлхүүр байхгүй бол хайхгүй', async () => {
    delete process.env.YOUTUBE_API_KEY;
    const f = mockSearch(() => Response.json({}));
    const { findVideo } = await load();
    expect(await findVideo('A', 'B')).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it('кирилл дуунд Монголын бүсээр хайна, түлхүүрийг хайлтын үгэнд оруулахгүй', async () => {
    const f = mockSearch(() => Response.json({ items: [] }));
    const { findVideo } = await load();
    await findVideo('Хурд', 'Аавдаа');
    const url = new URL(String((f.mock.calls as unknown as [string][])[0][0]));
    expect(url.searchParams.get('regionCode')).toBe('MN');
    expect(url.searchParams.get('q')).toBe('Хурд Аавдаа');
  });
});
