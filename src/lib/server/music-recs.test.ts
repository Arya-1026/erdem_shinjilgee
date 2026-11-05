import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MN_IDS, MN_SONGS } from '@/lib/mn-songs';
import type { SongRec } from '@/lib/types';
import { llmSmart } from './llm';
import { songRecs } from './music-recs';
import { classify } from './spotify';
import { artistSongs, findSong } from './spotify-search';

vi.mock('./llm', () => ({ llmConfigured: () => true, llmSmart: vi.fn() }));
vi.mock('./spotify', () => ({ spotifyConfigured: () => true, classify: vi.fn() }));
vi.mock('./spotify-search', () => ({ QuotaExceeded: class extends Error {}, findSong: vi.fn(), artistSongs: vi.fn() }));

const intl = JSON.stringify({ s: Array.from({ length: 10 }, (_, i) => ({ t: `Song ${i}`, a: `Artist ${i}`, why: 'тохирно' })) });
const found = (id: string, title: string, channel = 'Хурд') => ({ video_id: id, title, channel, thumbnail: null, duration_s: 200 });
const foreign = (i: number): SongRec => ({ video_id: `en${i}`, title: `Song ${i}`, artist: `Artist ${i}`, thumbnail: null, duration_s: 200, reason: '' });

function fakeDb(existing: (SongRec & { created_at: string })[], profile: { hobbies?: string[]; birth_year?: number; fav_artists?: string[] } = {}) {
  const inserted: SongRec[][] = [];
  const from = (table: string) => {
    const q = {
      then: (ok: (v: unknown) => void) => ok({ data: table === 'song_recs' ? existing : table === 'profiles' ? { hobbies: [], ...profile } : table === 'mood_entries' ? null : [] }),
      insert: (rows: SongRec[]) => { inserted.push(rows); return q; },
    } as Record<string, unknown>;
    for (const m of ['select', 'eq', 'order', 'limit', 'like', 'single', 'maybeSingle', 'delete']) q[m] = () => q;
    return q;
  };
  return { db: { from } as unknown as Parameters<typeof songRecs>[0], inserted };
}

describe('songRecs', () => {
  beforeEach(() => {
    vi.mocked(llmSmart).mockReset().mockResolvedValue({ text: intl, provider: 't' });
    vi.mocked(artistSongs).mockReset().mockResolvedValue([]);
    vi.mocked(classify).mockReset().mockResolvedValue(new Map());
    vi.mocked(findSong).mockReset().mockImplementation(async (a, title) => found(`en${Number(title.split(' ')[1])}`, title, a));
  });

  it('тал нь шалгасан дуу, тал нь олон улсын, ээлжилж гарна', async () => {
    const { recs } = await songRecs(fakeDb([]).db, 'u', 'sad', false);
    expect(recs).toHaveLength(8);
    expect(recs.map(r => MN_IDS.has(r.video_id))).toEqual([true, false, true, false, true, false, true, false]);
  });

  it('дуртай дуучны дуу жагсаалтад заавал орно', async () => {
    vi.mocked(artistSongs).mockImplementation(async name => (name === 'Хурд' ? [found('fav1', 'Шинэ дуу')] : []));
    vi.mocked(classify).mockResolvedValue(new Map([['fav1', ['sad']]]));
    const { recs } = await songRecs(fakeDb([], { fav_artists: ['Хурд'], birth_year: 1990 }).db, 'u', 'sad', false);
    expect(recs[0]).toMatchObject({ video_id: 'fav1', title: 'Шинэ дуу', reason: expect.stringContaining('Таны дуртай дуучин') });
  });

  it('mood тодорхойгүйг AI сонгоогүй бол нөхөхгүй', async () => {
    vi.mocked(artistSongs).mockImplementation(async name => (name === 'Хурд' ? [found('calm1', 'Тайван')] : []));
    vi.mocked(classify).mockResolvedValue(new Map([['calm1', ['calm']]]));
    const { recs } = await songRecs(fakeDb([], { fav_artists: ['Хурд'] }).db, 'u', 'sad', false);
    expect(recs.some(r => r.video_id === 'calm1')).toBe(false);
  });

  it('mood тодорхойгүй дууг AI сонговол орно', async () => {
    vi.mocked(artistSongs).mockImplementation(async name => (name === 'Хурд' ? [found('n1', 'Нулимсаа')] : []));
    vi.mocked(classify).mockResolvedValue(new Map([['n1', ['calm']]]));
    vi.mocked(llmSmart).mockResolvedValue({ text: JSON.stringify({ mn: [{ i: 0, why: 'гунигт ойр' }], s: [] }), provider: 't' });
    const { recs } = await songRecs(fakeDb([], { fav_artists: ['Хурд'] }).db, 'u', 'sad', false);
    expect(recs[0]).toMatchObject({ video_id: 'n1', reason: expect.stringContaining('Таны дуртай дуучин') });
  });

  it('сонгосон төрлийн дуучдыг хайна, уурласан үед хатууг алгасна', async () => {
    await songRecs(fakeDb([], { hobbies: ['Рок', 'Метал'] }).db, 'u', 'angry', false);
    const names = vi.mocked(artistSongs).mock.calls.map(c => c[0]);
    expect(names.length).toBeGreaterThan(0);
    expect(names).not.toContain('The HU');
  });

  it('AI-ийн сонгосон дугаараар шалгасан дууг сонгож, шалтгааныг нь авна', async () => {
    vi.mocked(llmSmart).mockResolvedValue({ text: JSON.stringify({ mn: [{ i: 2, why: 'танд таарна' }], s: [] }), provider: 't' });
    const { recs } = await songRecs(fakeDb([]).db, 'u', 'calm', false);
    expect(recs[0].reason).toContain('Тайван');
  });

  it('уурласан үед хатуу дуучин, метал гарахгүй', async () => {
    vi.mocked(artistSongs).mockImplementation(async name => (name === 'The HU' ? [found('hu', 'Wolf', 'The HU')] : []));
    vi.mocked(classify).mockResolvedValue(new Map([['hu', ['angry']]]));
    const { recs } = await songRecs(fakeDb([], { hobbies: ['Метал'], fav_artists: ['The HU'] }).db, 'u', 'angry', false);
    const metal = new Set(MN_SONGS.filter(s => s.genres.includes('Метал')).map(s => s.id));
    expect(recs.some(r => r.video_id === 'hu' || metal.has(r.video_id))).toBe(false);
    expect(vi.mocked(artistSongs).mock.calls.some(c => c[0] === 'The HU')).toBe(false);
  });

  it('хуучин YouTube-ийн жагсаалтыг дахин үүсгэнэ', async () => {
    const { cached } = await songRecs(fakeDb([{ ...foreign(0), video_id: 'cGAT-y6Ffss', created_at: new Date().toISOString() }]).db, 'u', 'sad', false);
    expect(cached).toBe(false);
  });

  it('хадгалсан жагсаалт 7 хоног cache-ээс гарна', async () => {
    const { cached } = await songRecs(fakeDb([{ ...foreign(0), video_id: '0123456789abcdefghijkl', created_at: new Date().toISOString() }]).db, 'u', 'sad', false);
    expect(cached).toBe(true);
    expect(findSong).not.toHaveBeenCalled();
  });

  it('Spotify хайлт бүтэхгүй ч шалгасан дуу гарна', async () => {
    vi.mocked(findSong).mockResolvedValue(null);
    const { recs } = await songRecs(fakeDb([]).db, 'u', 'angry', false);
    expect(recs.length).toBeGreaterThanOrEqual(4);
    expect(recs.every(r => MN_IDS.has(r.video_id))).toBe(true);
  });

  it('ая (ambient) дээр шалгасан дууны жагсаалт холихгүй', async () => {
    const { recs } = await songRecs(fakeDb([]).db, 'u', 'calm', false, 'ambient');
    expect(recs.some(r => MN_IDS.has(r.video_id))).toBe(false);
  });
});
