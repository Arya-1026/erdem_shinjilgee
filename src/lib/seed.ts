/* ---------- Демо өгөгдөл: 5 долоо хоног, Даваа гарагт доогуур байх хэв маягтай ---------- */
import { addDays, ymd } from './date';
import type { Entry, MoodId } from './types';

export function demoEntries(): Omit<Entry, 'id'>[] {
  const base = [3.8, 1.8, 2.8, 3, 3.2, 4, 4.5]; // Ням..Бямба
  const byScore: Record<number, MoodId[]> = { 5: ['happy'], 4: ['calm'], 3: ['neutral'], 2: ['tired', 'anxious'], 1: ['sad', 'angry'] };
  const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
  const out: Omit<Entry, 'id'>[] = [];
  for (let i = 35; i >= 1; i--) {
    if (Math.random() < 0.12) continue;
    const d = addDays(new Date(), -i);
    const sc = Math.max(1, Math.min(5, Math.round(base[d.getDay()] + (Math.random() * 1.6 - 0.8))));
    out.push({
      entry_date: ymd(d), entry_time: '21:00', mood: pick(byScore[sc]), intensity: 3, note: '',
      tags: sc <= 2 ? [pick(['Ажил', 'Хичээл', 'Ажил', 'Нойр'])] : [pick(['Найз нөхөд', 'Гэр бүл'])],
      sleep: sc <= 2 ? 5 + Math.round(Math.random() * 2) / 2 : 7 + Math.round(Math.random() * 2) / 2,
    });
  }
  return out;
}
