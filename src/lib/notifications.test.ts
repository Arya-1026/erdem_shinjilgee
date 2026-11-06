import { describe, expect, it } from 'vitest';
import { buildNotices, unseenCount } from './notifications';

const base = { today: '2026-11-06', tomorrow: '2026-11-07', now: '20:00', reminder: { on: true, time: '21:00:00' }, entries: [], todos: [], bookings: [], chats: [] };

describe('хонхны мэдэгдэл', () => {
  it('юу ч байхгүй бол хоосон', () => expect(buildNotices(base)).toEqual([]));
  it('сануулга цаг болоход, бүртгээгүй үед л гарна', () => {
    expect(buildNotices({ ...base, now: '21:00' }).map(n => n.id)).toEqual(['mood:2026-11-06']);
    expect(buildNotices({ ...base, now: '21:00', entries: [{ entry_date: '2026-11-06' }] })).toEqual([]);
    expect(buildNotices({ ...base, now: '21:00', reminder: { on: false, time: '21:00:00' } })).toEqual([]);
  });
  it('зурвас, ажил, уулзалтыг цуглуулна', () => {
    const out = buildNotices({
      ...base,
      chats: [{ id: 'a', name: 'Бат', unread: 2 }, { id: 'b', name: 'Сүх', unread: 0 }],
      todos: [{ planned_date: '2026-11-06', done: false }, { planned_date: '2026-11-06', done: true }, { planned_date: '2026-11-07', done: false }],
      bookings: [{ id: '1', booking_date: '2026-11-07', slot: '10:00', status: 'booked' }, { id: '2', booking_date: '2026-11-06', slot: '11:00', status: 'cancelled' }],
    });
    expect(out.map(n => n.href)).toEqual(['/friends/a', '/experts', '/todo']);
    expect(out[0].args).toEqual(['Бат', 2]);
    expect(out[2].args).toEqual([1]);
  });
  it('хараагүйг тоолно, найзын хүсэлт үргэлж тоологдоно', () => {
    expect(unseenCount([{ id: 'a' }, { id: 'b' }], new Set(['a']), 2)).toBe(3);
    expect(unseenCount([], new Set(), 0)).toBe(0);
  });
});
