import { describe, expect, it } from 'vitest';
import { calendarTable, dayCapacity, isFixed, parseExplain, parseTaskList, planGentle, planTodos, recentState, supportHints, taskLoad, weekdayProfile } from './todo-plan';
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
      { title: 'Тайлан', category: 'Хичээл', effort: 3, minutes: 90, due_date: '2026-11-06', planned_date: null, planned_time: null, reason: '' },
      { title: 'X', category: 'Ажил', effort: 2, minutes: 30, due_date: null, planned_date: null, planned_time: null, reason: '' },
    ]);
    expect(parseTaskList('биш', TODAY)).toEqual([]);
  });
  it('хэрэглэгчийн заасан өдөр, цагийг тогтоож, дахин хуваарилахад хөдөлгөхгүй', () => {
    const [r, past, bad] = parseTaskList('{"t":[{"title":"Шүд","on":"2026-11-09","time":"10:00"},{"title":"Хуучин","on":"2026-10-01","time":"25:00"},{"title":"Буруу","on":"маргааш"}]}', TODAY);
    expect(r).toMatchObject({ planned_date: '2026-11-09', planned_time: '10:00' });
    expect(isFixed(r)).toBe(true);
    expect(past).toMatchObject({ planned_date: null, planned_time: null, reason: '' });
    expect(isFixed(past)).toBe(false);
    expect(bad.planned_date).toBeNull();
  });
  it('LLM-д огноог гарагтай нь хүснэгтээр өгнө', () => {
    // 2026-11-04 Лхагва: «дараагийн даваа» нь 11/09, «дараа долоо хоногийн» мөрүүд 11/09-өөс эхэлнэ
    const rows = calendarTable('2026-11-04').split('\n');
    expect(rows[0]).toBe('2026-11-04 Wednesday (Лхагва) - today');
    expect(rows[1]).toContain('tomorrow');
    expect(rows.find(l => l.includes('Monday'))).toBe('2026-11-09 Monday (Даваа) - next week');
    expect(rows.find(l => l.startsWith('2026-11-08'))).toContain('this week');
  });
  it('тайлбарын тоо зөрвөл хэрэглэхгүй', () => {
    expect(parseExplain('{"why":["a"],"summary":"s"}', 2)).toEqual({ why: [], summary: 's' });
    expect(parseExplain('биш', 1)).toBeNull();
  });
});

describe('ачаалал багатай хуваарилалт', () => {
  const none = { mood: null, sleep: null, n: 0 };
  const load = (ps: { planned_date: string }[], minutes = 60) => { const l: Record<string, number> = {}; for (const p of ps) l[p.planned_date] = (l[p.planned_date] ?? 0) + minutes; return l; };

  it('сэтгэл санаа унадаг өдөр багтаамж бага', () => {
    expect(dayCapacity('2026-11-16', stats, TODAY, none)).toBeLessThan(dayCapacity('2026-11-18', stats, TODAY, none)); // Даваа, Лхагва
  });
  it('сүүлийн өдрүүдэд муу байвал ойрын өдрүүд хөнгөн, холын өдрүүд хэвийн', () => {
    const r = recentState([{ entry_date: '2026-11-01', mood: 'sad', sleep: 5 }, { entry_date: TODAY, mood: 'anxious', sleep: 5 }], TODAY);
    expect(r.n).toBe(2);
    const empty = weekdayProfile([], []);
    expect(dayCapacity(TODAY, empty, TODAY, r)).toBeLessThan(dayCapacity(TODAY, empty, TODAY, none));
    expect(dayCapacity('2026-11-10', empty, TODAY, r)).toBe(dayCapacity('2026-11-10', empty, TODAY, none));
  });
  it('хуучин бүртгэл одоогийн байдалд орохгүй', () => {
    expect(recentState([{ entry_date: '2026-10-20', mood: 'sad', sleep: 5 }], TODAY).n).toBe(0);
  });
  it('хүнд ажил нь жинтэй', () => {
    expect(taskLoad({ minutes: 60, effort: 3 })).toBeGreaterThan(taskLoad({ minutes: 60, effort: 1 }));
  });
  it('ажлыг жигд тарааж, нэг өдөр овоолохгүй', () => {
    const ps = planGentle(Array.from({ length: 10 }, (_, i) => task('t' + i)), weekdayProfile([], []), TODAY, none);
    expect(Math.max(...Object.values(load(ps)))).toBe(60);
    expect(planTodos(Array.from({ length: 10 }, (_, i) => task('t' + i)), weekdayProfile([], []), TODAY).length).toBe(10);
  });
  it('өдөрт нэгээс олон хүнд ажилгүй, сэтгэл санаа унадаг өдөр хүнд ажилгүй', () => {
    const ps = planGentle(Array.from({ length: 5 }, (_, i) => task('h' + i, { effort: 3 })), stats, TODAY, none);
    expect(new Set(ps.map(p => p.planned_date)).size).toBe(5);
    expect(ps.some(p => new Date(p.planned_date + 'T12:00').getDay() === 1)).toBe(false);
  });
  it('цаг багатай бол эцсийн хугацааг сэтгэл санаанаас урьтална', () => {
    const [p] = planGentle([task('a', { effort: 3, due_date: TODAY })], stats, TODAY, none);
    expect(p.planned_date).toBe(TODAY);
    expect(p.reason).toContain('эцсийн хугацаа');
  });
  it('хөдөлгөхгүй ажлын ачааллыг тооцно', () => {
    const [p] = planGentle([task('a')], weekdayProfile([], []), TODAY, none, { [TODAY]: 200 });
    expect(p.planned_date).not.toBe(TODAY);
  });
  it('шалтгааныг сэтгэл санаагаар тайлбарлана', () => {
    const r = { mood: 2, sleep: null, n: 3 };
    const [p] = planGentle([task('a', { due_date: TODAY })], weekdayProfile([], []), TODAY, r);
    expect(p.reason).toContain('Сүүлийн өдрүүдэд');
    expect(p.reason).toContain('минут');
  });
});
