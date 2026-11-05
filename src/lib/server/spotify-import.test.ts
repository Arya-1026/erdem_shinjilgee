import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearImported, importTracks, MAX_IMPORT, MAX_LIBRARY } from './spotify-import';
import { classify } from './spotify';

type Row = { user_id: string; track_id: string; moods?: string[]; artists?: string; name?: string };
let rows: Row[] = [];
const fakeDb = {
  from: () => ({
    select: () => ({ eq: async (_c: string, id: string) => ({ data: rows.filter(r => r.user_id === id) }) }),
    upsert: async (add: Row[]) => { rows = [...rows, ...add]; return {}; },
    delete: () => ({ eq: async (_c: string, id: string) => { rows = rows.filter(r => r.user_id !== id); return {}; } }),
  }),
};
vi.mock('@/lib/supabase/server', () => ({ createServiceClient: () => fakeDb }));
vi.mock('./spotify', () => ({ classify: vi.fn() }));

const id = (n: number) => String(n).padStart(22, 'a');
const lookedUp = (f: ReturnType<typeof vi.fn>) => f.mock.calls.map(c => decodeURIComponent(String(c[0])));

function mockOembed(ok: (url: string) => boolean = () => true) {
  const f = vi.fn(async (url: string | URL | Request) => (ok(decodeURIComponent(String(url)))
    ? new Response(JSON.stringify({ title: 'Дуу', thumbnail_url: 'https://i.scdn.co/x' }))
    : new Response('nope', { status: 404 })));
  vi.stubGlobal('fetch', f);
  return f;
}

describe('importTracks', () => {
  beforeEach(() => {
    rows = [];
    vi.mocked(classify).mockReset().mockImplementation(async list => new Map(list.map(t => [t.id, ['calm' as const]])));
  });

  it('дууг ангилж хэрэглэгчийн санд нэмнэ', async () => {
    const f = mockOembed();
    expect(await importTracks('u', [id(1), id(2)])).toEqual({ added: 2, existing: 0, failed: 0, skipped: 0, total: 2 });
    expect(rows.map(r => r.user_id)).toEqual(['u', 'u']);
    expect(rows[0]).toMatchObject({ moods: ['calm'], artists: '', name: 'Дуу' });
    expect(lookedUp(f)[0]).toBe(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${id(1)}`);
  });

  it('санд байгаа дууг дахин уншихгүй, өөр хэрэглэгчийн дуунд нөлөөлөхгүй', async () => {
    rows = [{ user_id: 'u', track_id: id(1) }, { user_id: 'other', track_id: id(2) }];
    const f = mockOembed();
    expect(await importTracks('u', [id(1), id(2)])).toMatchObject({ added: 1, existing: 1, total: 2 });
    expect(f).toHaveBeenCalledTimes(1);
    expect(lookedUp(f)[0]).toContain(id(2));
  });

  it('уншиж чадаагүй дууг алгасаж, бусдыг нэмнэ', async () => {
    mockOembed(url => !url.includes(id(2)));
    expect(await importTracks('u', [id(1), id(2), id(3)])).toMatchObject({ added: 2, failed: 1 });
    expect(rows.map(r => r.track_id)).not.toContain(id(2));
  });

  it('нэг удаад болон сангийн дээд хэмжээнээс хэтрүүлэхгүй', async () => {
    const f = mockOembed();
    const many = Array.from({ length: MAX_IMPORT + 5 }, (_, i) => id(i));
    expect(await importTracks('u', many)).toMatchObject({ added: MAX_IMPORT, skipped: 5 });
    expect(f).toHaveBeenCalledTimes(MAX_IMPORT);

    rows = Array.from({ length: MAX_LIBRARY }, (_, i) => ({ user_id: 'full', track_id: `x${i}` }));
    f.mockClear();
    expect(await importTracks('full', [id(1)])).toMatchObject({ added: 0, skipped: 1, failed: 0 });
    expect(f).not.toHaveBeenCalled();
  });

  it('AI ангилал байхгүй дуу «энгийн» болно', async () => {
    mockOembed();
    vi.mocked(classify).mockResolvedValue(new Map());
    await importTracks('u', [id(1)]);
    expect(rows[0].moods).toEqual(['neutral']);
  });

  it('цэвэрлэхэд зөвхөн тухайн хэрэглэгчийн сан устана', async () => {
    rows = [{ user_id: 'u', track_id: id(1) }, { user_id: 'other', track_id: id(2) }];
    await clearImported('u');
    expect(rows.map(r => r.user_id)).toEqual(['other']);
  });
});
