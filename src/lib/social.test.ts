import { describe, expect, it } from 'vitest';
import { cleanHandle, filterChats, HANDLE_RE, moodAgo, shortId, socialError } from './social';

describe('найз, зурвас', () => {
  it('@нэрийг цэвэрлэж шалгана', () => {
    expect(cleanHandle(' @Tungalag_01 ')).toBe('tungalag_01');
    expect(HANDLE_RE.test('tungalag_01')).toBe(true);
    expect(HANDLE_RE.test('ab')).toBe(false);
    expect(HANDLE_RE.test('Тунгалаг')).toBe(false);
    expect(HANDLE_RE.test('a b c')).toBe(false);
  });
  it('mood-ийн огноог ойлгомжтой бичнэ', () => {
    expect(moodAgo('2026-11-05', '2026-11-05')).toBe('өнөөдөр');
    expect(moodAgo('2026-11-04', '2026-11-05')).toBe('өчигдөр');
    expect(moodAgo('2026-11-01', '2026-11-05')).toBe('4 өдрийн өмнө');
    expect(moodAgo(null, '2026-11-05')).toBe('');
  });
  it('найзын жагсаалтыг нэр, уншаагүй, архиваар шүүнэ', () => {
    const p = (id: string, name: string, o: { unread?: number; archived?: boolean; handle?: string } = {}) =>
      ({ id, name, handle: o.handle ?? null, avatar: null, unread: o.unread ?? 0, archived: o.archived ?? false });
    const list = [p('1', 'Болд', { unread: 2 }), p('2', 'Сараа', { handle: 'saraa_01' }), p('3', 'Дулмаа', { archived: true, unread: 1 })];
    expect(filterChats(list, '', 'all').map(x => x.id)).toEqual(['1', '2']);
    expect(filterChats(list, '', 'unread').map(x => x.id)).toEqual(['1']);
    expect(filterChats(list, '', 'archived').map(x => x.id)).toEqual(['3']);
    expect(filterChats(list, 'бол', 'all').map(x => x.id)).toEqual(['1']);
    expect(filterChats(list, '@saraa', 'all').map(x => x.id)).toEqual(['2']);
  });
  it('ID-г богиносгож, серверийн алдааг монголоор хэлнэ', () => {
    expect(shortId('c4261898-c7a7-421f-86d1-e9d8d9ca83f5')).toBe('c4261898');
    expect(socialError({ message: 'not allowed' })).toContain('зөвхөн найзаасаа');
    expect(socialError({ message: 'blocked' })).toContain('боломжгүй');
    expect(socialError(null)).toContain('Алдаа');
  });
});
