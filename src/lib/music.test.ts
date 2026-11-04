import { describe, expect, it } from 'vitest';
import { FEATURED, interleave, MN_SONGS, pickMongolian } from './mn-songs';
import { parseVideoClassification, videoClassifyPrompt } from './mood-classify';
import { parseSuggestions, suggestPrompt, topArtists } from './music-suggest';
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
      expect(MN_SONGS.slice(0, FEATURED).filter(s => s.moods.includes(m)).length).toBeGreaterThanOrEqual(2);
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
  it('ээлжлэн холино', () => {
    expect(interleave([1, 2, 3], [9])).toEqual([1, 9, 2, 3]);
    expect(interleave([], [9])).toEqual([9]);
  });
});
