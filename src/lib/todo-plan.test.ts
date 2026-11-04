import { describe, expect, it } from 'vitest';
import { parseExplain, parseTaskList, planTodos, supportHints, weekdayProfile } from './todo-plan';
import type { Todo } from './types';

// 2026-11-02 Даваа. Лхагва сайн, Даваа муу сэтгэл санаатай хүн
const entries = ['2026-10-05', '2026-10-12', '2026-10-19'].flatMap(mon => [
  { entry_date: mon, mood: 'sad' as const, intensity: 2, sleep: 5 },
  { entry_date: mon.replace(/\d\d$/, d => String(+d + 2).padStart(2, '0')), mood: 'happy' as const, intensity: 5, sleep: 8 },
]);
const task = (id: string, o: Partial<Todo> = {}) => ({ id, effort: 2, minutes: 60, category: 'Ажил', due_date: null, ...o });
const stats = weekdayProfile(entries, []);
const TODAY = '2026-11-02';

describe('төлөвлөгөө', () => {
  it('гарагийн хэв маягийг тооцно', () => {
    expect(stats[1]).toMatchObject({ mood: 1, energy: 2, n: 3 });
    expect(stats[3]).toMatchObject({ mood: 5, energy: 5, n: 3 });
    expect(stats[5].mood).toBeNull();
  });
  it('хүнд ажлыг сайн өдөр, тайлбартай нь тавина', () => {
    const [p] = planTodos([task('a', { effort: 3 })], stats, TODAY);
    expect(new Date(p.planned_date + 'T12:00').getDay()).toBe(3);
    expect(p.reason).toContain('Лхагва');
    expect(p.reason).toContain('хүнд ажилд');
  });
  it('эцсийн хугацааг хэтрүүлэхгүй', () => {
    const [p] = planTodos([task('a', { effort: 3, due_date: '2026-11-03' })], stats, TODAY);
    expect(p.planned_date <= '2026-11-03').toBe(true);
  });
  it('нэг өдөрт хэт ачаалахгүй', () => {
    const tasks = Array.from({ length: 8 }, (_, i) => task('t' + i, { effort: 3, minutes: 90 }));
    const load: Record<string, number> = {};
    for (const p of planTodos(tasks, stats, TODAY)) load[p.planned_date] = (load[p.planned_date] ?? 0) + 90;
    expect(Math.max(...Object.values(load))).toBeLessThanOrEqual(180);
  });
  it('бүртгэлгүй хүнд ч хуваарилж, шалтгааныг тайлбарлана', () => {
    const [p] = planTodos([task('a')], weekdayProfile([], []), TODAY);
    expect(p.planned_date).toBe(TODAY);
    expect(p.reason).toContain('цөөн');
  });
  it('дуусгасан түүхийг ашиглана', () => {
    const history = Array.from({ length: 3 }, () => ({ category: 'Хичээл', done_at: '2026-10-30T10:00:00' }));
    const [p] = planTodos([task('a', { category: 'Хичээл' })], weekdayProfile([], history), TODAY);
    expect(new Date(p.planned_date + 'T12:00').getDay()).toBe(5);
    expect(p.reason).toContain('Хичээл');
  });
  it('сул өдөр ажил их бол урьдчилан анхааруулна', () => {
    const hints = supportHints([{ planned_date: '2026-11-02', minutes: 90, done: false }, { planned_date: '2026-11-04', minutes: 90, done: false }], stats, TODAY);
    expect(hints.map(h => h.date)).toEqual(['2026-11-02']);
    expect(hints[0].text).toContain('Даваа');
  });
  it('AI-ийн ажлын жагсаалтыг шалгаж авна', () => {
    const rows = parseTaskList('{"t":[{"title":" Тайлан ","category":"Хичээл","effort":3,"minutes":90,"due":"2026-11-06"},{"title":"","effort":9},{"title":"X","category":"?","effort":9,"minutes":"a","due":"2020-01-01"}]}', TODAY);
    expect(rows).toEqual([
      { title: 'Тайлан', category: 'Хичээл', effort: 3, minutes: 90, due_date: '2026-11-06' },
      { title: 'X', category: 'Ажил', effort: 2, minutes: 30, due_date: null },
    ]);
    expect(parseTaskList('биш', TODAY)).toEqual([]);
  });
  it('тайлбарын тоо зөрвөл хэрэглэхгүй', () => {
    expect(parseExplain('{"why":["a"],"summary":"s"}', 2)).toEqual({ why: [], summary: 's' });
    expect(parseExplain('биш', 1)).toBeNull();
  });
});
