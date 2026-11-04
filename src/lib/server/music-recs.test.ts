import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MN_IDS, MN_SONGS } from '@/lib/mn-songs';
import type { SongRec } from '@/lib/types';
import { songRecs } from './music-recs';
import { findSong } from './youtube';

vi.mock('./llm', () => ({
  llmConfigured: () => true,
  llmChat: async () => ({ text: JSON.stringify({ s: Array.from({ length: 10 }, (_, i) => ({ t: `Song ${i}`, a: `Artist ${i}`, why: 'тохирно' })) }) }),
}));
vi.mock('./youtube', () => ({
  QuotaExceeded: class extends Error {},
  youtubeSearchConfigured: () => true,
  getYouTubeToken: async () => null,
  findSong: vi.fn(),
}));

const foreign = (i: number): SongRec => ({ video_id: `en${i}`, title: `Song ${i}`, artist: `Artist ${i}`, thumbnail: null, duration_s: 200, reason: '' });

/** song_recs-ийн хариуг өгөөд бусад хүснэгтэд хоосон буцаах хуурамч Supabase */
function fakeDb(existing: (SongRec & { created_at: string })[], hobbies: string[] = []) {
  const inserted: SongRec[][] = [];
  const from = (table: string) => {
    const q = {
      then: (ok: (v: unknown) => void) => ok({ data: table === 'song_recs' ? existing : table === 'profiles' ? { hobbies } : table === 'mood_entries' ? null : [] }),
      insert: (rows: SongRec[]) => { inserted.push(rows); return q; },
    } as Record<string, unknown>;
    for (const m of ['select', 'eq', 'order', 'limit', 'like', 'single', 'maybeSingle', 'delete']) q[m] = () => q;
    return q;
  };
  return { db: { from } as unknown as Parameters<typeof songRecs>[0], inserted };
}

describe('songRecs', () => {
  beforeEach(() => {
    vi.mocked(findSong).mockReset();
    vi.mocked(findSong).mockImplementation(async (_a, title) => {
      const i = Number(title.split(' ')[1]);
      return { video_id: `en${i}`, title, channel: 'c', thumbnail: null, duration_s: 200 };
    });
  });

  it('дууны тал нь монгол, ээлжилж гарна', async () => {
    const { recs } = await songRecs(fakeDb([]).db, 'u', 'sad', false);
    expect(recs).toHaveLength(6);
    expect(recs.map(r => MN_IDS.has(r.video_id))).toEqual([true, false, true, false, true, false]);
  });

  it('сонгосон төрлөөр монгол дуу сонгоно', async () => {
    const { recs } = await songRecs(fakeDb([], ['Йог', 'Метал']).db, 'u', 'angry', false);
    const metal = new Set(MN_SONGS.filter(s => s.genres.includes('Метал')).map(s => s.id));
    const mn = recs.filter(r => MN_IDS.has(r.video_id));
    expect(mn).toHaveLength(3);
    expect(mn.every(r => metal.has(r.video_id))).toBe(true);
  });

  it('монгол дуугүй хуучин жагсаалтыг 7 хоног хүлээлгүй шинэчилнэ', async () => {
    const old = new Date(Date.now() - 864e5).toISOString();
    const { db, inserted } = fakeDb([0, 1, 2].map(i => ({ ...foreign(i), created_at: old })));
    const { recs, cached } = await songRecs(db, 'u', 'sad', false);
    expect(cached).toBe(false);
    expect(recs.some(r => MN_IDS.has(r.video_id))).toBe(true);
    expect(inserted).toHaveLength(1);
  });

  it('монгол дуутай жагсаалт cache-ээс гарна', async () => {
    const old = new Date(Date.now() - 864e5).toISOString();
    const mn = { ...foreign(0), video_id: [...MN_IDS][0], created_at: old };
    const { cached } = await songRecs(fakeDb([mn]).db, 'u', 'sad', false);
    expect(cached).toBe(true);
    expect(findSong).not.toHaveBeenCalled();
  });

  it('YouTube хайлт бүтэхгүй ч монгол дуу гарна', async () => {
    vi.mocked(findSong).mockResolvedValue(null);
    const { recs } = await songRecs(fakeDb([]).db, 'u', 'angry', false);
    expect(recs).toHaveLength(6);
    expect(recs.every(r => MN_IDS.has(r.video_id))).toBe(true);
  });

  it('ая (ambient) дээр монгол дууны жагсаалт холихгүй', async () => {
    const { recs } = await songRecs(fakeDb([]).db, 'u', 'calm', false, 'ambient');
    expect(recs.some(r => MN_IDS.has(r.video_id))).toBe(false);
  });
});
