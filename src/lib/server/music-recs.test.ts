import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MN_IDS, MN_SONGS } from '@/lib/mn-songs';
import type { SongRec } from '@/lib/types';
import { llmSmart } from './llm';
import { songRecs } from './music-recs';
import { artistVideos, findSong, labelSongs } from './youtube';

vi.mock('./llm', () => ({ llmConfigured: () => true, llmSmart: vi.fn() }));
vi.mock('./youtube', () => ({
  QuotaExceeded: class extends Error {},
  youtubeSearchConfigured: () => true,
  getYouTubeToken: async () => null,
  findSong: vi.fn(),
  artistVideos: vi.fn(),
  labelSongs: vi.fn(),
}));

const intl = JSON.stringify({ s: Array.from({ length: 10 }, (_, i) => ({ t: `Song ${i}`, a: `Artist ${i}`, why: 'тохирно' })) });
const found = (id: string, title: string) => ({ video_id: id, title, channel: 'c', thumbnail: null, duration_s: 200 });
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
    vi.mocked(artistVideos).mockReset().mockResolvedValue([]);
    vi.mocked(labelSongs).mockReset().mockResolvedValue(new Map());
    vi.mocked(findSong).mockReset().mockImplementation(async (_a, title) => found(`en${Number(title.split(' ')[1])}`, title));
  });

  it('тал нь шалгасан дуу, тал нь олон улсын, ээлжилж гарна', async () => {
    const { recs } = await songRecs(fakeDb([]).db, 'u', 'sad', false);
    expect(recs).toHaveLength(8);
    expect(recs.map(r => MN_IDS.has(r.video_id))).toEqual([true, false, true, false, true, false, true, false]);
  });

  it('дуртай дуучны дуу жагсаалтад заавал орно', async () => {
    vi.mocked(artistVideos).mockImplementation(async name => (name === 'Хурд' ? [found('fav1', 'Хурд - Шинэ дуу')] : []));
    vi.mocked(labelSongs).mockResolvedValue(new Map([['fav1', { music: true, artist: 'Хурд', song: 'Шинэ дуу', moods: ['sad'] }]]));
    const { recs } = await songRecs(fakeDb([], { fav_artists: ['Хурд'], birth_year: 1990 }).db, 'u', 'sad', false);
    expect(recs[0]).toMatchObject({ video_id: 'fav1', title: 'Шинэ дуу', reason: 'Таны дуртай дуучин' });
  });

  it('өөр дуучны бичлэг орохгүй, mood тодорхойгүйг AI сонгоогүй бол нөхөхгүй', async () => {
    vi.mocked(artistVideos).mockImplementation(async name => (name === 'Хурд' ? [found('kid', 'ХҮРДНИЙ ДУУ'), found('calm1', 'Хурд - Тайван')] : []));
    vi.mocked(labelSongs).mockResolvedValue(new Map([
      ['kid', { music: true, artist: 'Dino Mino', song: 'Хүрдний дуу', moods: ['sad'] }],
      ['calm1', { music: true, artist: 'Хурд', song: 'Тайван', moods: ['calm'] }],
    ]));
    const { recs } = await songRecs(fakeDb([], { fav_artists: ['Хурд'] }).db, 'u', 'sad', false);
    expect(recs.some(r => r.video_id === 'kid' || r.video_id === 'calm1')).toBe(false);
  });

  it('mood тодорхойгүй дууг AI сонговол орно', async () => {
    vi.mocked(artistVideos).mockImplementation(async name => (name === 'Хурд' ? [found('n1', 'Хурд - Нулимсаа')] : []));
    vi.mocked(labelSongs).mockResolvedValue(new Map([['n1', { music: true, artist: 'Хурд', song: 'Нулимсаа', moods: ['calm'] }]]));
    vi.mocked(llmSmart).mockResolvedValue({ text: JSON.stringify({ mn: [{ i: 0, why: 'гунигт ойр' }], s: [] }), provider: 't' });
    const { recs } = await songRecs(fakeDb([], { fav_artists: ['Хурд'] }).db, 'u', 'sad', false);
    expect(recs[0]).toMatchObject({ video_id: 'n1', reason: 'гунигт ойр' });
  });

  it('AI-ийн сонгосон дугаараар шалгасан дууг сонгож, шалтгааныг нь авна', async () => {
    vi.mocked(llmSmart).mockResolvedValue({ text: JSON.stringify({ mn: [{ i: 2, why: 'танд таарна' }], s: [] }), provider: 't' });
    const { recs } = await songRecs(fakeDb([]).db, 'u', 'calm', false);
    expect(recs[0].reason).toBe('танд таарна');
  });

  it('уурласан үед хатуу дуучин, метал гарахгүй', async () => {
    vi.mocked(artistVideos).mockImplementation(async name => (name === 'The HU' ? [found('hu', 'The HU - Wolf')] : []));
    vi.mocked(labelSongs).mockResolvedValue(new Map([['hu', { music: true, artist: 'The HU', song: 'Wolf', moods: ['angry'] }]]));
    const { recs } = await songRecs(fakeDb([], { hobbies: ['Метал'], fav_artists: ['The HU'] }).db, 'u', 'angry', false);
    const metal = new Set(MN_SONGS.filter(s => s.genres.includes('Метал')).map(s => s.id));
    expect(recs.some(r => r.video_id === 'hu' || metal.has(r.video_id))).toBe(false);
    expect(vi.mocked(artistVideos).mock.calls.some(c => c[0] === 'The HU')).toBe(false);
  });

  it('хуучин зарчмаар үүссэн жагсаалтыг дахин үүсгэнэ', async () => {
    const { cached } = await songRecs(fakeDb([{ ...foreign(0), created_at: '2026-11-04T07:19:53Z' }]).db, 'u', 'sad', false);
    expect(cached).toBe(false);
  });

  it('хадгалсан жагсаалт 7 хоног cache-ээс гарна', async () => {
    const { cached } = await songRecs(fakeDb([{ ...foreign(0), created_at: new Date().toISOString() }]).db, 'u', 'sad', false);
    expect(cached).toBe(true);
    expect(findSong).not.toHaveBeenCalled();
  });

  it('YouTube хайлт бүтэхгүй ч шалгасан дуу гарна', async () => {
    vi.mocked(findSong).mockResolvedValue(null);
    const { recs } = await songRecs(fakeDb([]).db, 'u', 'angry', false);
    expect(recs.length).toBeGreaterThanOrEqual(6);
    expect(recs.every(r => MN_IDS.has(r.video_id))).toBe(true);
  });

  it('ая (ambient) дээр шалгасан дууны жагсаалт холихгүй', async () => {
    const { recs } = await songRecs(fakeDb([]).db, 'u', 'calm', false, 'ambient');
    expect(recs.some(r => MN_IDS.has(r.video_id))).toBe(false);
  });
});
