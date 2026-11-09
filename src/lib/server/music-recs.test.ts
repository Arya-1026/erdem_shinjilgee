import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MN_IDS, MN_SONGS } from '@/lib/mn-songs';
import type { SongRec } from '@/lib/types';
import { llmConfigured, llmSmart } from './llm';
import { songRecs } from './music-recs';
import { classify } from './spotify';
import { artistSongs, findSong, genreSongs, QuotaExceeded } from './spotify-search';

vi.mock('./llm', () => ({ llmConfigured: vi.fn(() => true), llmSmart: vi.fn() }));
vi.mock('./spotify', () => ({ spotifyConfigured: () => true, classify: vi.fn() }));
vi.mock('./spotify-search', () => ({ QuotaExceeded: class extends Error {}, findSong: vi.fn(), artistSongs: vi.fn(), genreSongs: vi.fn() }));

const ambientReply = JSON.stringify({ s: Array.from({ length: 10 }, (_, i) => ({ t: `Song ${i}`, a: `Artist ${i}`, why: 'тохирно' })) });
const found = (id: string, title: string, channel = 'Хурд') => ({ video_id: id, title, channel, thumbnail: null, duration_s: 200 });
const foreign = (i: number): SongRec => ({ video_id: `en${i}`, title: `Song ${i}`, artist: `Artist ${i}`, thumbnail: null, duration_s: 200, reason: '' });
/** Олон улсын төрлийн сан: дуучин бүр өөр */
const genrePool = (prefix: string, n = 8) => Array.from({ length: n }, (_, i) => found(`${prefix}${i}`, `${prefix} ${i}`, `${prefix} artist ${i}`));
const fitAll = (mood: string, ...lists: { video_id: string }[][]) => new Map(lists.flat().map(s => [s.video_id, [mood]])) as never;
const SPOTIFY_ID = '0123456789abcdefghijkl';

function fakeDb(existing: (SongRec & { created_at: string })[], profile: { hobbies?: string[]; birth_year?: number; fav_artists?: string[] } = {}, feedback: { rec_id: string; value: number }[] = []) {
  const inserted: SongRec[][] = [];
  let deleted = 0;
  const from = (table: string) => {
    const q = {
      then: (ok: (v: unknown) => void) => ok({ data: table === 'song_recs' ? existing : table === 'profiles' ? { hobbies: [], ...profile } : table === 'mood_entries' ? null : table === 'rec_feedback' ? feedback : [] }),
      insert: (rows: SongRec[]) => { inserted.push(rows); return q; },
      delete: () => { deleted++; return q; },
    } as Record<string, unknown>;
    for (const m of ['select', 'eq', 'order', 'limit', 'like', 'single', 'maybeSingle']) q[m] = () => q;
    return q;
  };
  return { db: { from } as unknown as Parameters<typeof songRecs>[0], inserted, deletes: () => deleted };
}

describe('songRecs', () => {
  beforeEach(() => {
    vi.mocked(llmConfigured).mockReset().mockReturnValue(true);
    vi.mocked(llmSmart).mockReset().mockResolvedValue({ text: JSON.stringify({ picks: [] }), provider: 't' });
    vi.mocked(artistSongs).mockReset().mockResolvedValue([]);
    vi.mocked(genreSongs).mockReset().mockResolvedValue([]);
    vi.mocked(classify).mockReset().mockResolvedValue(new Map());
    vi.mocked(findSong).mockReset().mockImplementation(async (a, title) => found(`en${Number(title.split(' ')[1])}`, title, a));
  });

  it('тал нь монгол, тал нь олон улсын, ээлжилж гарна', async () => {
    const pop = genrePool('pop');
    vi.mocked(genreSongs).mockResolvedValue(pop);
    vi.mocked(classify).mockResolvedValue(fitAll('sad', pop));
    const { recs } = await songRecs(fakeDb([], { hobbies: ['Поп'] }).db, 'u', 'sad', false);
    expect(recs).toHaveLength(8);
    expect(recs.map(r => MN_IDS.has(r.video_id))).toEqual([true, false, true, false, true, false, true, false]);
  });

  it('дууны санал AI-ийн зохиосон нэрээр хайхгүй, зөвхөн сангаас сонгоно', async () => {
    await songRecs(fakeDb([]).db, 'u', 'sad', false);
    expect(findSong).not.toHaveBeenCalled();
    expect(vi.mocked(llmSmart).mock.calls[0][0][0].content).toContain('Choose only from the given list');
  });

  it('дуртай дуучны дуу жагсаалтад заавал орно', async () => {
    vi.mocked(artistSongs).mockImplementation(async name => (name === 'Хурд' ? [found('fav1', 'Шинэ дуу')] : []));
    vi.mocked(classify).mockResolvedValue(new Map([['fav1', ['sad']]]));
    const { recs } = await songRecs(fakeDb([], { fav_artists: ['Хурд'], birth_year: 1990 }).db, 'u', 'sad', false);
    expect(recs[0]).toMatchObject({ video_id: 'fav1', title: 'Шинэ дуу', reason: expect.stringContaining('Таны дуртай дуучин') });
  });

  it('эрэмбэ: дуртай дуучин → сонгосон төрөл → хоббигийн төрөл', async () => {
    const fav = [found('fav1', 'Fav', 'Taylor Swift')], rock = genrePool('rock', 2), hobby = genrePool('lofi', 3);
    vi.mocked(artistSongs).mockImplementation(async name => (name === 'Taylor Swift' ? fav : []));
    vi.mocked(genreSongs).mockImplementation(async q => (q === 'rock' ? rock : q === 'lo-fi' ? hobby : []));
    vi.mocked(classify).mockResolvedValue(fitAll('calm', fav, rock, hobby));
    const { recs } = await songRecs(fakeDb([], { hobbies: ['Рок', 'Програмчлал'], fav_artists: ['Taylor Swift'] }).db, 'u', 'calm', false);
    const ids = recs.map(r => r.video_id).filter(id => /^(fav|rock|lofi)/.test(id));
    expect(ids[0]).toBe('fav1');
    expect(ids.findIndex(id => id.startsWith('rock'))).toBeLessThan(ids.findIndex(id => id.startsWith('lofi')));
  });

  it('AI-ийн сонголт ч эрэмбээрээ гарна', async () => {
    const rock = genrePool('rock', 2), hobby = genrePool('lofi', 2);
    vi.mocked(genreSongs).mockImplementation(async q => (q === 'rock' ? rock : q === 'lo-fi' ? hobby : []));
    vi.mocked(classify).mockResolvedValue(new Map());
    vi.mocked(llmSmart).mockImplementation(async prompt => {
      const lines = prompt[1].content.split('\n');
      const index = (id: string) => Number(lines.find(l => l.includes(id))!.split('.')[0]);
      return { text: JSON.stringify({ picks: [{ i: index('lofi 0') }, { i: index('rock 0') }] }), provider: 't' };
    });
    const { recs } = await songRecs(fakeDb([], { hobbies: ['Рок', 'Програмчлал'] }).db, 'u', 'calm', false);
    const ids = recs.map(r => r.video_id).filter(id => /^(rock|lofi)/.test(id));
    expect(ids).toEqual(['rock0', 'lofi0']);
  });

  it('хобби нь Spotify-ийн төрлийн сангаас дуу гаргана, шалтгаанд бичигдэнэ', async () => {
    const lofi = genrePool('lofi');
    vi.mocked(genreSongs).mockImplementation(async q => (q === 'lo-fi' ? lofi : []));
    vi.mocked(classify).mockResolvedValue(fitAll('calm', lofi));
    const { recs } = await songRecs(fakeDb([], { hobbies: ['Програмчлал'] }).db, 'u', 'calm', false);
    expect(vi.mocked(genreSongs).mock.calls.map(c => c[0])).toContain('lo-fi');
    expect(recs.find(r => r.video_id.startsWith('lofi'))?.reason).toContain('«Програмчлал» хоббид тань');
  });

  it('төрлийн хайлт хоосон бол олон улсын дуучдаар нөхнө', async () => {
    await songRecs(fakeDb([], { hobbies: ['Поп'] }).db, 'u', 'calm', false);
    const intl = new Set(['Olivia Rodrigo', 'Taylor Swift', 'Ed Sheeran', 'Adele', 'Bruno Mars', 'Billie Eilish', 'Dua Lipa', 'Michael Jackson', 'Celine Dion', 'ABBA', 'The Weeknd', 'Coldplay']);
    expect(vi.mocked(artistSongs).mock.calls.some(c => intl.has(c[0]))).toBe(true);
  });

  it('төрлийн сан хангалттай бол олон улсын дуучдыг нэмж хайхгүй', async () => {
    vi.mocked(genreSongs).mockResolvedValue(genrePool('pop', 12));
    await songRecs(fakeDb([], { hobbies: ['Поп'] }).db, 'u', 'calm', false);
    const names = vi.mocked(artistSongs).mock.calls.map(c => c[0]);
    expect(names.some(n => ['Olivia Rodrigo', 'Taylor Swift', 'Ed Sheeran', 'Adele', 'BTS', 'Drake'].includes(n))).toBe(false);
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
    vi.mocked(llmSmart).mockResolvedValue({ text: JSON.stringify({ picks: [{ i: 0, why: 'гунигт ойр' }] }), provider: 't' });
    const { recs } = await songRecs(fakeDb([], { fav_artists: ['Хурд'] }).db, 'u', 'sad', false);
    expect(recs[0]).toMatchObject({ video_id: 'n1', reason: expect.stringContaining('Таны дуртай дуучин') });
  });

  it('AI байхгүй үед mood-оор ангилсан дуунаас автоматаар сонгоно', async () => {
    vi.mocked(llmConfigured).mockReturnValue(false);
    const pop = genrePool('pop');
    vi.mocked(genreSongs).mockResolvedValue(pop);
    vi.mocked(classify).mockResolvedValue(fitAll('happy', pop));
    const { recs } = await songRecs(fakeDb([], { hobbies: ['Поп'] }).db, 'u', 'happy', false);
    expect(llmSmart).not.toHaveBeenCalled();
    expect(recs).toHaveLength(8);
    expect(recs.some(r => r.video_id.startsWith('pop'))).toBe(true);
  });

  it('сонгосон төрлийн дуучдыг хайна, уурласан үед хатууг алгасна', async () => {
    await songRecs(fakeDb([], { hobbies: ['Рок', 'Метал'] }).db, 'u', 'angry', false);
    const names = vi.mocked(artistSongs).mock.calls.map(c => c[0]);
    expect(names.length).toBeGreaterThan(0);
    expect(names).not.toContain('The HU');
    expect(vi.mocked(genreSongs).mock.calls.map(c => c[0])).not.toContain('metal');
  });

  it('AI-ийн сонгосон дугаараар шалгасан дууг сонгож, зорилгыг нь авна', async () => {
    vi.mocked(llmSmart).mockResolvedValue({ text: JSON.stringify({ picks: [{ i: 2, why: 'танд таарна' }] }), provider: 't' });
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

  it('👎 дарсан дуу гарахгүй', async () => {
    const pop = genrePool('pop');
    vi.mocked(genreSongs).mockResolvedValue(pop);
    vi.mocked(classify).mockResolvedValue(fitAll('happy', pop));
    const { recs } = await songRecs(fakeDb([], { hobbies: ['Поп'] }, [{ rec_id: 'sp:pop0', value: -1 }]).db, 'u', 'happy', false);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.some(r => r.video_id === 'pop0')).toBe(false);
  });

  it('хуучин YouTube-ийн жагсаалтыг дахин үүсгэнэ', async () => {
    const { cached } = await songRecs(fakeDb([{ ...foreign(0), video_id: 'cGAT-y6Ffss', created_at: new Date().toISOString() }]).db, 'u', 'sad', false);
    expect(cached).toBe(false);
  });

  it('хадгалсан жагсаалт 7 хоног cache-ээс гарна', async () => {
    const { cached } = await songRecs(fakeDb([{ ...foreign(0), video_id: SPOTIFY_ID, created_at: new Date().toISOString() }]).db, 'u', 'sad', false);
    expect(cached).toBe(true);
    expect(genreSongs).not.toHaveBeenCalled();
  });

  it('хайлтын эрх дуусч олон улсын дуу дутвал хадгалахгүй, дараагийн хүсэлт нөхнө', async () => {
    vi.mocked(artistSongs).mockImplementation(async (_n, _a, budget) => { budget.left = 0; return []; });
    const f = fakeDb([], { hobbies: ['Поп'], fav_artists: ['Хурд'] });
    const { recs, cached } = await songRecs(f.db, 'u', 'sad', false);
    expect(recs.length).toBeGreaterThan(0);
    expect(cached).toBe(false);
    expect(f.inserted).toHaveLength(0);
  });

  describe('Spotify квот дууссан үед', () => {
    const quota = () => { throw new QuotaExceeded(); };
    const old = new Date(Date.now() - 8 * 864e5).toISOString();

    it('эхний алдааны дараа шинэ хайлт хийх эрхийг 0 болгоно', async () => {
      const budgets: number[] = [];
      vi.mocked(artistSongs).mockImplementation(async (_n, _a, budget) => { budgets.push(budget.left); return quota(); });
      await songRecs(fakeDb([], { fav_artists: ['Хурд', 'Нисванис', 'Харанга'] }).db, 'u', 'sad', false);
      // Дуртай дуучид эхний давалгаанд зэрэг хайгдана, квот дууссаны дараах давалгаа (каталогийн дуучид) эрхгүй
      expect(budgets.slice(0, 3)).toEqual([5, 5, 5]);
      expect(budgets.length).toBeGreaterThan(3);
      expect(budgets.slice(3).every(b => b === 0)).toBe(true);
    });

    it('хуучин сайн жагсаалтыг дарж бичихгүй, LLM дуудахгүй', async () => {
      vi.mocked(genreSongs).mockImplementation(quota);
      vi.mocked(artistSongs).mockImplementation(quota);
      const f = fakeDb([{ ...foreign(0), video_id: SPOTIFY_ID, created_at: old }], { hobbies: ['Поп'] });
      const res = await songRecs(f.db, 'u', 'sad', false);
      expect(res).toMatchObject({ cached: true, reason: 'quota' });
      expect(res.recs[0].video_id).toBe(SPOTIFY_ID);
      expect(f.inserted).toHaveLength(0);
      expect(f.deletes()).toBe(0);
      expect(llmSmart).not.toHaveBeenCalled();
    });

    it('анхны жагсаалт бол гараар шалгасан дуу гарах ч хадгалагдахгүй', async () => {
      vi.mocked(genreSongs).mockImplementation(quota);
      vi.mocked(artistSongs).mockImplementation(quota);
      const f = fakeDb([], { hobbies: ['Поп'] });
      const { recs, reason } = await songRecs(f.db, 'u', 'angry', false);
      expect(recs.length).toBeGreaterThanOrEqual(4);
      expect(recs.every(r => MN_IDS.has(r.video_id))).toBe(true);
      expect(reason).toBe('quota');
      expect(f.inserted).toHaveLength(0);
    });

    it('cache-д хангалттай дуутай бол бүрэн жагсаалт болж хадгалагдана', async () => {
      const pop = genrePool('pop');
      vi.mocked(genreSongs).mockResolvedValue(pop);
      vi.mocked(artistSongs).mockImplementation(quota);
      vi.mocked(classify).mockResolvedValue(fitAll('happy', pop));
      const f = fakeDb([], { hobbies: ['Поп'] });
      const res = await songRecs(f.db, 'u', 'happy', false);
      expect(res.reason).toBeUndefined();
      expect(f.inserted).toHaveLength(1);
      expect(llmSmart).toHaveBeenCalled();
    });

    it('ая: хайлт зогсож, хуучин жагсаалт үлдэнэ', async () => {
      vi.mocked(llmSmart).mockResolvedValue({ text: ambientReply, provider: 't' });
      vi.mocked(findSong).mockImplementation(quota);
      const f = fakeDb([{ ...foreign(0), video_id: SPOTIFY_ID, created_at: old }]);
      const res = await songRecs(f.db, 'u', 'calm', false, 'ambient');
      expect(findSong).toHaveBeenCalledTimes(1);
      expect(res).toMatchObject({ cached: true, reason: 'quota' });
      expect(f.deletes()).toBe(0);
    });
  });

  it('ая (ambient) дээр шалгасан дууны жагсаалт холихгүй, AI-ийн нэрээр хайна', async () => {
    vi.mocked(llmSmart).mockResolvedValue({ text: ambientReply, provider: 't' });
    const { recs } = await songRecs(fakeDb([]).db, 'u', 'calm', false, 'ambient');
    expect(recs.some(r => MN_IDS.has(r.video_id))).toBe(false);
    expect(recs).toHaveLength(8);
    expect(genreSongs).not.toHaveBeenCalled();
  });
});
