import { describe, expect, it } from 'vitest';
import { DASS_COUNT, DASS_ITEMS, dassLevel, needsHelp, scoreDass } from './dass';

describe('DASS-21', () => {
  it('21 асуулт, дэд хэмжүүр бүр 7, албан ёсны дугаарлалт', () => {
    expect(DASS_COUNT).toBe(21);
    const idx = (s: string) => DASS_ITEMS.flatMap((x, i) => (x.scale === s ? [i + 1] : []));
    expect(idx('depression')).toEqual([3, 5, 10, 13, 16, 17, 21]);
    expect(idx('anxiety')).toEqual([2, 4, 7, 9, 15, 19, 20]);
    expect(idx('stress')).toEqual([1, 6, 8, 11, 12, 14, 18]);
  });

  it('дэд оноог нэмээд ×2 хийнэ', () => {
    expect(scoreDass(Array(21).fill(0))).toEqual({ depression: 0, anxiety: 0, stress: 0 });
    expect(scoreDass(Array(21).fill(3))).toEqual({ depression: 42, anxiety: 42, stress: 42 });
    const a = Array(21).fill(0); a[2] = 1; a[1] = 2; a[0] = 3; // 3-р гутрал, 2-р түгшүүр, 1-р стресс
    expect(scoreDass(a)).toEqual({ depression: 2, anxiety: 4, stress: 6 });
  });

  it('буруу хариултыг хүлээж авахгүй', () => {
    expect(() => scoreDass(Array(20).fill(0))).toThrow();
    expect(() => scoreDass([...Array(20).fill(0), 4])).toThrow();
  });

  it('түвшний босго (×2 хийсний дараах)', () => {
    expect([9, 10, 13, 14, 20, 21, 27, 28].map(s => dassLevel('depression', s))).toEqual(['normal', 'mild', 'mild', 'moderate', 'moderate', 'severe', 'severe', 'extreme']);
    expect([7, 8, 9, 10, 14, 15, 19, 20].map(s => dassLevel('anxiety', s))).toEqual(['normal', 'mild', 'mild', 'moderate', 'moderate', 'severe', 'severe', 'extreme']);
    expect([14, 15, 18, 19, 25, 26, 33, 34].map(s => dassLevel('stress', s))).toEqual(['normal', 'mild', 'mild', 'moderate', 'moderate', 'severe', 'severe', 'extreme']);
  });

  it('хүнд түвшин эсвэл «амьдрал утгагүй» өндөр бол тусламж санал болгоно', () => {
    expect(needsHelp({ depression: 20, anxiety: 14, stress: 25 })).toBe(false);
    expect(needsHelp({ depression: 21, anxiety: 0, stress: 0 })).toBe(true);
    const a = Array(21).fill(0); a[20] = 2;
    expect(needsHelp(scoreDass(a), a)).toBe(true);
  });
});
