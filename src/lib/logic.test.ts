import { describe, expect, it } from 'vitest';
import { fallbackReply } from './chat-fallback';
import { isCrisisText } from './crisis';
import { moodById } from './data';
import { groupSlots, normalizeEntry } from './db';
import { classifyPrompt, heuristicMoods, parseClassification } from './mood-classify';
import { scoredRecs } from './recs';
import { pickImage, playlistEntryTrack, toTrack } from './spotify-parse';

describe('crisis шүүлтүүр', () => {
  it.each(['Би үхмээр байна', 'Амиа хорлох тухай бодож байна', 'өөрийгөө гэмтээмээр', 'АМЬДРАХ ХҮСЭЛ АЛГА'])('"%s" → crisis', t => expect(isCrisisText(t)).toBe(true));
  it.each(['Өнөөдөр ядарч байна', 'Шалгалтаас болж стресстэй', 'үхрийн мах идсэн'])('"%s" → crisis биш', t => expect(isCrisisText(t)).toBe(false));
});

describe('scoredRecs', () => {
  const sad = moodById('sad');
  it('mood таарсан зөвлөмжийг л буцаана', () => {
    expect(scoredRecs(sad, [], {}).every(r => r.moods.includes('sad') || r.hob)).toBe(true);
  });
  it('хобби таарвал дээш гарна', () => {
    const top = scoredRecs(sad, ['Зураг'], {})[0];
    expect(top.id).toBe('e8');
    expect(top.hob).toBe(true);
  });
  it('👎 дарсныг хасна', () => {
    expect(scoredRecs(sad, [], { s3: -1 }).some(r => r.id === 's3')).toBe(false);
  });
});

describe('fallbackReply', () => {
  const ctx = { name: 'Бат', hobbies: ['Гүйлт'], entries: [], feedback: {}, mode: 'listen' as const };
  it('түлхүүр үгээр сэдвийг таньна', () => {
    expect(fallbackReply('шалгалтаас болж стресстэй байна', ctx)).toContain('Pomodoro');
    expect(fallbackReply('нойр хүрэхгүй', ctx)).toContain('унт');
  });
  it('таньж чадахгүй бол горимын хариулт', () => {
    expect(fallbackReply('сайн уу', ctx)).toContain('сонсож байна');
  });
});

describe('mood ангилал', () => {
  it('LLM-ийн JSON хариуг задална, буруу утгыг шүүнэ', () => {
    const m = parseClassification('Here: {"r":[{"i":0,"m":["sad","calm","bogus"]},{"i":1,"m":["happy"]},{"i":9,"m":["sad"]},{"i":2,"m":[]}]}', 3);
    expect(m.get(0)).toEqual(['sad', 'calm']);
    expect(m.get(1)).toEqual(['happy']);
    expect(m.has(2)).toBe(false);
    expect(m.has(9)).toBe(false);
  });
  it('буруу JSON бол хоосон', () => expect(parseClassification('not json {', 2).size).toBe(0));
  it('түлхүүр үгийн нөөц ангилал', () => {
    expect(heuristicMoods({ name: 'Someone Like You', artists: 'Adele' })).toContain('sad');
    expect(heuristicMoods({ name: 'Happy', artists: 'Pharrell Williams' })).toContain('happy');
    expect(heuristicMoods({ name: 'Untitled 7', artists: 'X' })).toEqual(['neutral']);
  });
  it('prompt нь бүх дууг дугаарлана', () => {
    expect(classifyPrompt([{ id: 'a', name: 'A', artists: 'B' }, { id: 'b', name: 'C', artists: 'D' }])[1].content).toBe('0. A — B\n1. C — D');
  });
});

describe('Spotify хариу задлах', () => {
  const raw = { type: 'track', id: 't1', name: 'Song', uri: 'spotify:track:t1', duration_ms: 200000, artists: [{ name: 'A' }, { name: 'B' }],
    album: { images: [{ url: 'big', width: 640 }, { url: 'mid', width: 300 }, { url: 'small', width: 64 }] } };
  it('track объектыг хөрвүүлнэ', () => {
    expect(toTrack(raw)).toEqual({ id: 't1', name: 'Song', uri: 'spotify:track:t1', duration_ms: 200000, artists: 'A, B', image: 'small' });
  });
  it('episode, local, id-гүйг алгасна', () => {
    expect(toTrack({ ...raw, type: 'episode' })).toBeNull();
    expect(toTrack({ ...raw, is_local: true })).toBeNull();
    expect(toTrack({ ...raw, id: null })).toBeNull();
  });
  it('playlist мөр: шинэ `item`, хуучин `track`, boolean `track`', () => {
    expect(playlistEntryTrack({ item: raw, track: true })?.id).toBe('t1');
    expect(playlistEntryTrack({ track: raw })?.id).toBe('t1');
    expect(playlistEntryTrack({ track: true })).toBeNull();
    expect(playlistEntryTrack({ item: raw, is_local: true })).toBeNull();
  });
  it('pickImage', () => {
    expect(pickImage(undefined)).toBeNull();
    expect(pickImage([{ url: 'only', width: null }])).toBe('only');
  });
});

describe('db туслах', () => {
  it('groupSlots гараг тус бүрээр эрэмбэлнэ', () => {
    expect(groupSlots([{ expert_id: 'p1', weekday: 1, slot: '14:00' }, { expert_id: 'p1', weekday: 1, slot: '10:00' }, { expert_id: 'p2', weekday: 3, slot: '11:30' }]))
      .toEqual({ p1: { 1: ['10:00', '14:00'] }, p2: { 3: ['11:30'] } });
  });
  it('normalizeEntry numeric, time-ийг хөрвүүлнэ', () => {
    expect(normalizeEntry({ sleep: '7.5', entry_time: '21:05:00' })).toEqual({ sleep: 7.5, entry_time: '21:05' });
    expect(normalizeEntry({ sleep: null, entry_time: '08:00' }).sleep).toBeNull();
  });
});
