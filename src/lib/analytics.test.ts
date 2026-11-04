import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dayAvg, insights, needsExpert, prediction, scoreLevel, streak, topTag, weekdayStats } from './analytics';
import { addDays, ymd } from './date';
import type { Entry, MoodId } from './types';

let n = 0;
const entry = (date: string, mood: MoodId, extra: Partial<Entry> = {}): Entry =>
  ({ id: String(n++), entry_date: date, entry_time: '21:00', mood, intensity: 3, tags: [], note: '', sleep: null, ...extra });

// 2026-11-03 бол Мягмар гараг
const NOW = new Date('2026-11-03T15:00:00');
const day = (offset: number) => ymd(addDays(NOW, offset));

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterEach(() => vi.useRealTimers());

describe('streak', () => {
  it('өнөөдрөөс хойш тасралтгүй өдрийг тоолно', () => {
    expect(streak([entry(day(0), 'happy'), entry(day(-1), 'calm'), entry(day(-2), 'sad'), entry(day(-4), 'sad')])).toBe(3);
  });
  it('өнөөдөр бүртгээгүй бол өчигдрөөс эхэлж тоолно', () => {
    expect(streak([entry(day(-1), 'happy'), entry(day(-2), 'happy')])).toBe(2);
  });
  it('бүртгэлгүй бол 0', () => expect(streak([])).toBe(0));
});

describe('weekdayStats', () => {
  it('гараг бүрийн дундаж онооног тооцно', () => {
    // 2026-11-02 Даваа: happy(5) + sad(1) → 3
    const s = weekdayStats([entry('2026-11-02', 'happy'), entry('2026-11-02', 'sad'), entry('2026-11-03', 'calm')]);
    expect(s[1]).toEqual({ w: 1, avg: 3, n: 2 });
    expect(s[2]).toEqual({ w: 2, avg: 4, n: 1 });
    expect(s[0].avg).toBeNull();
  });
});

describe('prediction', () => {
  it('өгөгдөл хангалтгүй бол "none"', () => {
    expect(prediction([entry(day(-1), 'happy')]).level).toBe('none');
  });
  it('маргаашийн гараг (Лхагва) дунджаас доогуур бол "low" ба шалтгааныг дурдана', () => {
    const list = [
      entry('2026-10-28', 'sad', { tags: ['Ажил'] }), entry('2026-10-21', 'angry', { tags: ['Ажил'] }), // Лхагва
      entry('2026-10-29', 'happy'), entry('2026-10-30', 'happy'), entry('2026-10-31', 'happy'), entry('2026-11-01', 'calm'),
    ];
    const p = prediction(list);
    expect(p.level).toBe('low');
    expect(p.title).toContain('Лхагва');
    expect(p.text).toContain('Ажил');
  });
  it('дунджаас дээгүүр бол "high" ба хоббиг дурдана', () => {
    const list = [entry('2026-10-28', 'happy'), entry('2026-10-21', 'happy'), entry('2026-10-29', 'sad'), entry('2026-10-30', 'neutral')];
    const p = prediction(list, 'Гүйлт');
    expect(p.level).toBe('high');
    expect(p.text).toContain('Гүйлт');
  });
});

describe('insights', () => {
  it('нойр бага өдрүүдэд сэтгэл санаа доогуур байгааг илрүүлнэ', () => {
    const low = [-1, -2, -3].map(d => entry(day(d), 'sad', { sleep: 5 }));
    const high = [-4, -5, -6].map(d => entry(day(d), 'happy', { sleep: 8 }));
    expect(insights([...low, ...high]).some(t => t.includes('6 цагаас бага'))).toBe(true);
  });
  it('өгөгдөлгүй бол ерөнхий зөвлөгөө өгнө', () => {
    expect(insights([])).toEqual(['Илүү их бүртгэл хийх тусам ажиглалт нарийвчлагдана.']);
  });
});

describe('бусад', () => {
  it('needsExpert: сүүлийн 5 бүртгэл маш доогуур бол true', () => {
    expect(needsExpert([-5, -4, -3, -2, -1].map(d => entry(day(d), 'sad')))).toBe(true);
    expect(needsExpert([-5, -4, -3, -2, -1].map(d => entry(day(d), d === -1 ? 'happy' : 'sad')))).toBe(false);
    expect(needsExpert([entry(day(-1), 'sad')])).toBe(false);
  });
  it('topTag хамгийн их давтагдсан тагийг буцаана', () => {
    expect(topTag([entry(day(0), 'sad', { tags: ['Ажил', 'Нойр'] }), entry(day(-1), 'sad', { tags: ['Ажил'] })])).toBe('Ажил');
  });
  it('dayAvg ба scoreLevel', () => {
    expect(dayAvg([entry(day(0), 'happy'), entry(day(0), 'neutral')], day(0))).toBe(4);
    expect([1, 1.6, 2.6, 3.6, 4.6].map(scoreLevel)).toEqual([1, 2, 3, 4, 5]);
  });
});
