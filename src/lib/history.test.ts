import { describe, expect, it } from 'vitest';
import { filterDayNotes, filterEntries, filterJournals, groupByDay, groupByMood } from './history';
import type { Entry, MoodId } from './types';

const e = (id: string, entry_date: string, entry_time: string, mood: MoodId, note = ''): Entry => ({ id, entry_date, entry_time, mood, note, intensity: 3, tags: [], sleep: 7 });
const list = [e('a', '2026-11-05', '09:00', 'sad', 'Шалгалт'), e('b', '2026-11-06', '08:00', 'happy'), e('c', '2026-11-06', '20:15', 'sad', 'Сайхан өдөр')];
const all = { mood: null, date: '', notesOnly: false };

describe('сэтгэл хөдлөлийн түүх', () => {
  it('шинэ нь эхэндээ', () => expect(filterEntries(list, all).map(x => x.id)).toEqual(['c', 'b', 'a']));
  it('сэтгэл хөдлөл, өдөр, тэмдэглэлээр шүүнэ', () => {
    expect(filterEntries(list, { ...all, mood: 'sad' }).map(x => x.id)).toEqual(['c', 'a']);
    expect(filterEntries(list, { ...all, date: '2026-11-05' }).map(x => x.id)).toEqual(['a']);
    expect(filterEntries(list, { ...all, notesOnly: true }).map(x => x.id)).toEqual(['c', 'a']);
    expect(filterEntries(list, { mood: 'happy', date: '2026-11-05', notesOnly: false })).toEqual([]);
  });
  it('өдрөөр бүлэглэнэ', () => {
    expect(groupByDay(list).map(g => [g.date, g.items.map(x => x.id)])).toEqual([['2026-11-06', ['c', 'b']], ['2026-11-05', ['a']]]);
  });
  it('сэтгэл хөдлөлөөр бүлэглэж, хоосныг алгасна', () => {
    expect(groupByMood(list).map(g => [g.mood, g.items.length])).toEqual([['happy', 1], ['sad', 2]]);
  });
});

describe('өдрийн тэмдэглэл', () => {
  const j = { day: '2026-11-04', mood: 'calm' as const, body: 'Тайван өдөр' };
  const n = { id: 'n', day: '2026-11-03', body: 'Нэмэлт', created_at: '' };
  it('зөвхөн тэмдэглэлтэй өдөр ч бүлэгт орно', () => {
    expect(groupByDay(list, [j], [n]).map(g => g.date)).toEqual(['2026-11-06', '2026-11-05', '2026-11-04', '2026-11-03']);
    expect(groupByDay(list, [j], [n])[2].journal).toEqual(j);
    expect(groupByDay(list, [j], [n])[3].notes).toEqual([n]);
  });
  it('сэтгэл хөдлөлөөр бүлэглэхэд өдрийн тэмдэглэл ч орно', () => {
    expect(groupByMood([], [j])).toEqual([{ mood: 'calm', items: [], journals: [j] }]);
  });
  it('сэтгэл хөдлөлөөр шүүхэд нэмэлт тэмдэглэл гарахгүй', () => {
    expect(filterJournals([j], { ...all, mood: 'sad' })).toEqual([]);
    expect(filterJournals([j], { ...all, mood: 'calm' })).toEqual([j]);
    expect(filterDayNotes([n], { ...all, mood: 'sad' })).toEqual([]);
    expect(filterDayNotes([n], { ...all, date: '2026-11-03' })).toEqual([n]);
  });
});
