import { describe, expect, it } from 'vitest';
import { RECS } from './data';
import { EN } from './i18n/en';
import { BENEFITS, expandSteps, stepSeconds } from './exercise-benefits';

describe('дасгалын хугацаа, үр нөлөө', () => {
  it('дасгал бүр «юу өөрчлөгдөх» тайлбартай, англи орчуулгатай', () => {
    for (const r of RECS.filter(x => x.type === 'exercise')) {
      expect(BENEFITS[r.id], r.id).toBeTruthy();
      expect(EN[BENEFITS[r.id]], r.id).toBeTruthy();
    }
  });
  it('тексттэй секунд, минутыг авч, бусдыг нь тэнцүү хуваана', () => {
    expect(stepSeconds(['Хүзүүгээ 15 секунд хазайлга', 'Босоод 1 минут алх', 'Амсхий'], '4 мин · x')).toEqual([15, 60, 80]);
    expect(stepSeconds(['Нүүрээ 15–30 секунд угаа', 'a'], '1 мин · x')).toEqual([15, 30]);
    expect(stepSeconds(['a', 'b'], 'Гадаа')).toEqual([30, 30]);
  });
  it('хайрцаг амьсгалыг 4 тойрог болгоно', () => {
    const e11 = RECS.find(r => r.id === 'e11')!;
    const plan = expandSteps('e11', e11.steps!, stepSeconds(e11.steps!, e11.sub));
    expect(plan).toHaveLength(1 + 4 * 10);
    expect(plan.reduce((s, p) => s + p.sec, 0)).toBe(175);
    expect(plan.slice(1).every(p => p.sec === 4)).toBe(true);
    expect(plan.at(-1)).toMatchObject({ round: 10, rounds: 10, text: '4 тоолж хоосон барь' });
    expect(expandSteps('e2', ['a'], [30])).toEqual([{ text: 'a', sec: 30, round: 0, rounds: 0 }]);
  });
});
