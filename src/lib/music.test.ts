import { describe, expect, it } from 'vitest';
import { clampOffset, nearestCorner } from '@/components/use-drag';
import { ageGroup, artistOptions, hardAllowed, MN_ARTISTS, rankArtists } from './artists';
import { interleave, MN_SONGS, pickGenres, pickMongolian, SONG_GENRES } from './mn-songs';
import { balanceByGoal, MOOD_GOALS, parsePicks, parseSuggestions, suggestPrompt, topArtists } from './music-suggest';
import { songKey } from './spotify-parse';

describe('Cache-ийн түлхүүр', () => {
  it('том жижиг үсэг, тэмдэгт үл тооно', () => {
    expect(songKey('Adele', 'Someone Like You!')).toBe(songKey('ADELE ', 'someone  like you'));
    expect(songKey('Хурд', 'Аав минь')).toBe('хурд аав минь');
  });
});

describe('хүн бүрт тохирсон дууны санал', () => {
  const base = { mood: 'sad' as const, hobbies: ['Гүйлт'], artists: [], liked: [], disliked: [], exclude: [], count: 8 };
  it('хэрэглэгчийн амтыг prompt-д оруулна', () => {
    const p = suggestPrompt({ ...base, artists: ['The Lemons', 'Adele'], liked: ['Adele - Hello'], disliked: ['X - Y'], exclude: ['A - B'] })[1].content;
    expect(p).toContain('The Lemons, Adele');
    expect(p).toContain('Songs they liked: Adele - Hello');
    expect(p).toContain('avoid similar): X - Y');
    expect(p).toContain('Do NOT suggest any of these: A - B');
    expect(p).toContain('Гүйлт');
  });
  it('амт тодорхойгүй бол алдартай дуу санал болгоно', () => {
    expect(suggestPrompt(base)[1].content).toContain('Their taste is unknown');
  });
  it('хоёр өөр хэрэглэгчид өөр prompt (хувийн)', () => {
    expect(suggestPrompt({ ...base, artists: ['A'] })[1].content).not.toBe(suggestPrompt({ ...base, artists: ['B'] })[1].content);
  });
  it('хариуг задлах: давхардал, хоосныг хасна, max хүртэл', () => {
    const s = parseSuggestions('{"s":[{"t":"Hello","a":"Adele","why":"Тайвшруулна"},{"t":"hello","a":"adele"},{"t":"","a":"X"},{"t":"Fix You","a":"Coldplay"},{"t":"Yellow","a":"Coldplay"}]}', 2);
    expect(s).toEqual([{ title: 'Hello', artist: 'Adele', why: 'Тайвшруулна' }, { title: 'Fix You', artist: 'Coldplay', why: '' }]);
    expect(parseSuggestions('no json', 5)).toEqual([]);
  });
  it('topArtists хамтын бүтээлийг салгаж тоолно', () => {
    expect(topArtists(['Adele', 'Adele, Ed Sheeran', 'Mark Ronson ft. Bruno Mars', 'Bruno Mars'], 2)).toEqual(['Adele', 'Bruno Mars']);
  });
});

describe('Монгол дуу', () => {
  const moods = ['happy', 'calm', 'neutral', 'tired', 'anxious', 'sad', 'angry'] as const;
  it('mood бүрт хангалттай дуу байна', () => {
    for (const m of moods) {
      expect(MN_SONGS.filter(s => s.moods.includes(m)).length).toBeGreaterThanOrEqual(4);
    }
    expect(new Set(MN_SONGS.map(s => s.id)).size).toBe(MN_SONGS.length);
  });
  it('👎 дарсныг хасаж, сүүлд гарсныг хойш тавина', () => {
    const sad = MN_SONGS.filter(s => s.moods.includes('sad')).map(s => s.id);
    const out = pickMongolian('sad', new Set([sad[0]]), new Set([sad[1]]), 100).map(r => r.video_id);
    expect(out).not.toContain(sad[0]);
    expect(out.at(-1)).toBe(sad[1]);
    expect(pickMongolian('sad', new Set(), new Set(), 3)).toHaveLength(3);
  });
  it('төрөл бүрт монгол дуу санал болгоно', () => {
    for (const g of SONG_GENRES) for (const m of moods) {
      const out = pickMongolian(m, new Set(), new Set(), 3, [g]);
      expect(out, `${g} ${m}`).toHaveLength(3);
      // Ардын дуу, жазз, сонгодог Spotify-д цөөн тул жагсаалтад алга: уран бүтээлчээр хайгдана
      const listed = !['Ардын дуу', 'Жазз', 'Сонгодог хөгжим'].includes(g);
      if (listed && (g !== 'Метал' || hardAllowed(m))) expect(out[0].reason, `${g} ${m}`).toContain('Таны сонгосон төрөл');
    }
  });
  it('сонгосон төрөл mood-оос урьтална', () => {
    const rap = new Set(MN_SONGS.filter(s => s.genres.includes('Хип хоп, рэп')).map(s => s.id));
    for (const m of moods) expect(pickMongolian(m, new Set(), new Set(), 3, ['Хип хоп, рэп']).every(r => rap.has(r.video_id)), m).toBe(true);
  });
  it('төрөлгүй үед mood-оор сонгоно, хоббиос төрлийг ялгана', () => {
    const sad = new Set(MN_SONGS.filter(s => s.moods.includes('sad')).map(s => s.id));
    expect(pickMongolian('sad', new Set(), new Set(), 100).every(r => sad.has(r.video_id))).toBe(true);
    expect(pickGenres(['Йог', 'Рок', 'Гитар', 'Поп'])).toEqual(['Поп', 'Рок']);
  });
  it('LLM-д төрлийг англиар дамжуулна', () => {
    const base = { mood: 'sad', hobbies: [], artists: [], liked: [], disliked: [], exclude: [], count: 5 } as const;
    expect(suggestPrompt({ ...base, hobbies: [...base.hobbies], artists: [], liked: [], disliked: [], exclude: [], genres: ['Хип хоп, рэп', 'K-pop'] })[1].content).toContain('hip-hop / rap, K-pop');
    expect(suggestPrompt({ ...base, hobbies: [], artists: [], liked: [], disliked: [], exclude: [] })[1].content).not.toContain('Genres they chose');
  });
  it('уурласан, түгшсэн, гунигтай үед метал хэзээ ч гарахгүй', () => {
    const metal = new Set(MN_SONGS.filter(s => s.genres.includes('Метал')).map(s => s.id));
    for (const m of ['angry', 'anxious', 'sad', 'tired', 'calm'] as const) {
      expect(pickMongolian(m, new Set(), new Set(), 100, ['Метал']).some(r => metal.has(r.video_id)), m).toBe(false);
      expect(MN_SONGS.filter(s => s.moods.includes(m)).some(s => metal.has(s.id)), m).toBe(false);
    }
  });
  it('ууртай хүнд хатуу дуу санал болгохгүй гэж AI-д заана', () => {
    const base = { hobbies: [], artists: [], liked: [], disliked: [], exclude: [], count: 5 };
    const angry = suggestPrompt({ ...base, mood: 'angry', genres: ['Метал', 'Поп'] })[1].content;
    expect(angry).toContain('NEVER metal');
    expect(angry).not.toMatch(/Genres they chose:.*metal/);
    expect(suggestPrompt({ ...base, mood: 'happy', genres: ['Метал'] })[1].content).toMatch(/Genres they chose:.*metal/);
  });
  it('нас, төрлөөр уран бүтээлч эрэмбэлнэ', () => {
    expect(ageGroup(2010, 2026)).toBe('teen');
    expect(ageGroup(2004, 2026)).toBe('young');
    expect(ageGroup(1990, 2026)).toBe('adult');
    expect(ageGroup(1975, 2026)).toBe('mature');
    expect(ageGroup(1950, 2026)).toBe('senior');
    expect(ageGroup(null)).toBeNull();
    expect(rankArtists(MN_ARTISTS, 'senior', ['Ардын дуу'])[0].ages).toContain('senior');
    expect(rankArtists(MN_ARTISTS, 'teen', ['Хип хоп, рэп'])[0].genres).toContain('Хип хоп, рэп');
    const o = artistOptions('young', ['Поп']);
    expect(o.mongolian.length).toBeGreaterThan(5);
    expect(o.international.length).toBeGreaterThan(5);
  });
  it('AI-ийн сонголтыг задлана, буруу дугаарыг хасна', () => {
    expect(parsePicks('{"mn":[{"i":1,"why":"тохирно"},{"i":1},{"i":9},{"i":"x"}]}', 3)).toEqual([{ i: 1, why: 'тохирно' }]);
    expect(parsePicks('биш', 3)).toEqual([]);
  });
  it('ээлжлэн холино', () => {
    expect(interleave([1, 2, 3], [9])).toEqual([1, 9, 2, 3]);
    expect(interleave([], [9])).toEqual([9]);
  });
});

describe('тоглуулагч зөөх', () => {
  const box = { left: 100, top: 500, right: 300, bottom: 700 };
  it('дэлгэцээс гаргахгүй', () => {
    expect(clampOffset({ x: 0, y: -100 }, box, 375, 812)).toEqual({ x: 0, y: -100 });
    expect(clampOffset({ x: -500, y: -900 }, box, 375, 812)).toEqual({ x: -96, y: -496 });
    expect(clampOffset({ x: 500, y: 900 }, box, 375, 812)).toEqual({ x: 71, y: 108 });
  });
  it('өргөн элемент хажуу тийш бараг шилжихгүй', () => {
    expect(clampOffset({ x: 50, y: 0 }, { left: 8, top: 0, right: 367, bottom: 100 }, 375, 812).x).toBe(4);
  });
});

describe('чат буланд наалдах', () => {
  const area = { left: 0, top: 60, right: 375, bottom: 744 }; // Толгой, доод цэсийн хоорондох хэсэг
  const box = { left: 300, top: 660, right: 356, bottom: 716 };
  it('хамгийн ойрын буланг сонгож, цэсийг дарахгүй', () => {
    expect(nearestCorner({ x: 0, y: 0 }, box, area)).toEqual({ x: 9, y: 18 });
    expect(nearestCorner({ x: -250, y: 0 }, box, area)).toEqual({ x: -290, y: 18 });
    expect(nearestCorner({ x: 0, y: -500 }, box, area)).toEqual({ x: 9, y: -590 });
    expect(nearestCorner({ x: -250, y: -500 }, box, area)).toEqual({ x: -290, y: -590 });
  });
  it('хаана ч тавьсан доод хил нь цэсээс дээр', () => {
    for (const x of [-300, -100, 0]) for (const y of [-600, -200, 0, 200]) {
      const o = nearestCorner({ x, y }, box, area);
      expect(box.bottom + o.y).toBeLessThanOrEqual(area.bottom);
      expect(box.top + o.y).toBeGreaterThanOrEqual(area.top);
    }
  });
});

describe('mood-ийн зорилго', () => {
  it('гунигтай үед хоёр зорилгыг ээлжлэн авна', () => {
    const items = [{ id: 1, goal: 'comfort' }, { id: 2, goal: 'comfort' }, { id: 3, goal: 'comfort' }, { id: 4, goal: 'uplift' }, { id: 5 }];
    expect(balanceByGoal(items, MOOD_GOALS.sad, 3).map(x => x.id)).toEqual([1, 4, 2]);
    expect(balanceByGoal(items, MOOD_GOALS.sad, 5).map(x => x.id)).toEqual([1, 4, 2, 3, 5]);
  });
  it('уурласан, түгшсэн үед зөвхөн тайвшруулах', () => {
    expect(MOOD_GOALS.angry.map(g => g.key)).toEqual(['calm']);
    expect(MOOD_GOALS.anxious.map(g => g.key)).toEqual(['calm']);
  });
  it('AI-д зорилгыг дамжуулж, төрөл, дуучныг шаардана', () => {
    const c = suggestPrompt({ mood: 'sad', hobbies: [], artists: [], liked: [], disliked: [], exclude: [], count: 5, genres: ['Рок'], favArtists: ['Adele'] })[1].content;
    expect(c).toContain('"comfort"');
    expect(c).toContain('"uplift"');
    expect(c).toContain('must be by these artists');
    expect(c).toContain('must be in these genres');
  });
  it('зорилгыг задлана', () => {
    expect(parsePicks('{"mn":[{"i":0,"goal":"uplift","why":"x"}]}', 1)).toEqual([{ i: 0, goal: 'uplift', why: 'x' }]);
    expect(parseSuggestions('{"s":[{"t":"A","a":"B","goal":"comfort","why":""}]}', 3)[0].goal).toBe('comfort');
  });
});
