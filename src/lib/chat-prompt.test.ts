import { describe, expect, it } from 'vitest';
import { asksForExercise, asksForExpert, extractInlineActions, guessActions, splitActions } from './chat-prompt';

describe('чатын товч, сэтгэл зүйч', () => {
  it('ACTIONS, EXPERTS мөрийг аль ч дараалалтай салгана', () => {
    expect(splitActions('Сайн\nACTIONS: breath, partner\nEXPERTS: p2, p1')).toEqual({ text: 'Сайн', actions: ['breath', 'partner'], experts: ['p2', 'p1'] });
    expect(splitActions('Сайн\nEXPERTS: p2\nACTIONS: plan')).toEqual({ text: 'Сайн', actions: ['plan'], experts: ['p2'] });
    expect(splitActions('Зүгээр текст')).toEqual({ text: 'Зүгээр текст', actions: [], experts: [] });
  });
  it('сэтгэл зүйч зөвхөн асуусан үед', () => {
    expect(asksForExpert('сэтгэл зүйч санал болгооч')).toBe(true);
    expect(asksForExpert('хэнтэй уулзах вэ')).toBe(true);
    expect(asksForExpert('Харилцаа хүндэрсэн 💔')).toBe(false);
  });
  it('текст доторх кодыг товч болгож, нэрийг нь тавина', () => {
    const r = extractInlineActions('Харилцааны асуудалд «partner» дасгал тохиромжтой. Эсвэл journal буюу бичих дасгал.');
    expect(r.actions).toEqual(['partner', 'journal']);
    expect(r.text).toBe('Харилцааны асуудалд «Хайртай хүнтэйгээ ярилцах» дасгал тохиромжтой. Эсвэл «Талархлын тэмдэглэл» буюу бичих дасгал.');
    expect(extractInlineActions('Сайн уу').actions).toEqual([]);
    expect(asksForExercise('дасгал')).toBe(true);
    expect(asksForExercise('сайн уу')).toBe(false);
  });
  it('AI товч мартвал агуулгаар нь дасгал санал болгоно', () => {
    expect(guessActions('Харилцаа хүндэрсэн 💔')).toEqual(['partner']);
    expect(guessActions('Стресстэй байна 😣')).toEqual(['breath']);
    expect(guessActions('Нойр хүрэхгүй байна 🌙')).toEqual(['relax']);
    expect(guessActions('Хичээл, ажил давхцаад байна 📚')).toEqual(['plan']);
    expect(guessActions('лан тогломоор байна')).toEqual([]);
  });
});
