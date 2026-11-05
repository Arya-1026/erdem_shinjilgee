import { describe, expect, it } from 'vitest';
import { cleanHandle, HANDLE_RE, moodAgo, shortId, socialError } from './social';

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
  it('ID-г богиносгож, серверийн алдааг монголоор хэлнэ', () => {
    expect(shortId('c4261898-c7a7-421f-86d1-e9d8d9ca83f5')).toBe('c4261898');
    expect(socialError({ message: 'not allowed' })).toContain('зөвхөн найзаасаа');
    expect(socialError({ message: 'blocked' })).toContain('боломжгүй');
    expect(socialError(null)).toContain('Алдаа');
  });
});
