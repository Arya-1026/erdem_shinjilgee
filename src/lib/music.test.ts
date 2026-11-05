import { describe, expect, it } from 'vitest';
import { clampOffset, nearestCorner } from '@/components/use-drag';
import { ageGroup, artistOptions, hardAllowed, MN_ARTISTS, rankArtists } from './artists';
import { interleave, MN_SONGS, pickGenres, pickMongolian, SONG_GENRES } from './mn-songs';
import { parseVideoClassification, videoClassifyPrompt } from './mood-classify';
import { parsePicks, parseSuggestions, suggestPrompt, topArtists } from './music-suggest';
import { parseIsoDuration, pickThumb, songKey, splitTitle } from './youtube-parse';

describe('YouTube хариу задлах', () => {
  it('ISO хугацаа', () => {
    expect(parseIsoDuration('PT3M45S')).toBe(225);
    expect(parseIsoDuration('PT1H2M3S')).toBe(3723);
    expect(parseIsoDuration('PT59S')).toBe(59);
    expect(parseIsoDuration('P1DT1S')).toBe(86401);
    expect(parseIsoDuration('garbage')).toBe(0);
    expect(parseIsoDuration(undefined)).toBe(0);
  });
  it('гарчгаас уран бүтээлч, дууг салгана', () => {
    expect(splitTitle('Adele - Someone Like You (Official Music Video)')).toEqual({ artist: 'Adele', song: 'Someone Like You' });
    expect(splitTitle('The Lemons – Чамайг санана [Lyrics]')).toEqual({ artist: 'The Lemons', song: 'Чамайг санана' });
    expect(splitTitle('Holocene', 'Bon Iver - Topic')).toEqual({ artist: 'Bon Iver', song: 'Holocene' });
    expect(splitTitle('Just a vlog', '')).toBeNull();
  });
  it('cache түлхүүр том/жижиг үсэг, тэмдэгтийг үл тооно', () => {
    expect(songKey('Adele', 'Someone Like You!')).toBe(songKey('ADELE ', 'someone  like you'));
    expect(songKey('Хурд', 'Аав минь')).toBe('хурд аав минь');
  });
  it('pickThumb', () => {
    expect(pickThumb({ default: { url: 'd' }, medium: { url: 'm' } })).toBe('m');
    expect(pickThumb({ default: { url: 'd' } })).toBe('d');
    expect(pickThumb(undefined)).toBeNull();
  });
});

describe('YouTube бичлэг ангилах', () => {
  it('prompt-д Music ангиллыг дурдана', () => {
    const p = videoClassifyPrompt([{ id: 'a', title: 'Song', channel: 'Ch', music_category: true }, { id: 'b', title: 'Vlog', channel: 'Me', music_category: false }]);
    expect(p[1].content).toBe('0. Song | channel: Ch | category: Music\n1. Vlog | channel: Me');
  });
  it('дуу биш, дуу, буруу мөрийг ялгана', () => {
    const m = parseVideoClassification('{"r":[{"i":0,"music":true,"a":"Adele","s":"Hello","m":["sad","x"]},{"i":1,"music":false},{"i":2,"music":true,"a":"X","s":"","m":["sad"]},{"i":3,"music":true,"a":"Y","s":"Z","m":[]}]}', 4);
    expect(m.get(0)).toEqual({ music: true, artist: 'Adele', song: 'Hello', moods: ['sad'] });
    expect(m.get(1)?.music).toBe(false);
    expect(m.has(2)).toBe(false); // нэргүй
    expect(m.has(3)).toBe(false); // mood-гүй
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
      expect(MN_SONGS.filter(s => s.moods.includes(m)).length).toBeGreaterThanOrEqual(6);
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
      if (g !== 'Метал' || hardAllowed(m)) expect(out[0].reason, `${g} ${m}`).toContain('Таны сонгосон төрөл');
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
