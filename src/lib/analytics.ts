/* ---------- Шинжилгээ: entries дээр ажилладаг цэвэр функцууд (клиент, сервер хоёуланд) ---------- */
import { MOODS, WD, moodById } from './data';
import { addDays, today, weekdayOf, ymd } from './date';
import type { Entry, Mood } from './types';

export const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
export const scoreOf = (e: Pick<Entry, 'mood'>) => moodById(e.mood).score;

// Тайлангийн heatmap-ийн diverging шкал: 1 (цэнхэр) → 3 (саарал) → 5 (улбар шар). Өнгө нь globals.css-д.
export const scoreLevel = (s: number) => (s >= 4.5 ? 5 : s >= 3.5 ? 4 : s >= 2.5 ? 3 : s >= 1.5 ? 2 : 1);

export const dayAvg = (entries: Entry[], date: string) => mean(entries.filter(e => e.entry_date === date).map(scoreOf));
export const overallAvg = (entries: Entry[]) => mean(entries.map(scoreOf)) ?? 3;
export const lastMood = (entries: Entry[]): Mood => (entries.length ? moodById(entries[entries.length - 1].mood) : MOODS[2]);

export function weekdayStats(entries: Entry[]) {
  const sum = Array(7).fill(0), cnt = Array(7).fill(0);
  entries.forEach(e => { const w = weekdayOf(e.entry_date); sum[w] += scoreOf(e); cnt[w]++; });
  return sum.map((s, w) => ({ w, avg: cnt[w] ? s / cnt[w] : null as number | null, n: cnt[w] as number }));
}

export function streak(entries: Entry[]) {
  const set = new Set(entries.map(e => e.entry_date));
  let d = new Date(); if (!set.has(ymd(d))) d = addDays(d, -1);
  let n = 0; while (set.has(ymd(d))) { n++; d = addDays(d, -1); }
  return n;
}

export function topTag(entries: Entry[]) {
  const c: Record<string, number> = {};
  entries.forEach(e => e.tags.forEach(t => (c[t] = (c[t] || 0) + 1)));
  return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0];
}

export type Prediction = { level: 'none' | 'low' | 'mid' | 'high'; title: string; text: string };

// Маргаашийн таамаглал: тухайн гаригийн дундажийг нийт дундажтай харьцуулна (ML хэрэггүй, статистик).
export function prediction(entries: Entry[], hobby?: string): Prediction {
  const w = addDays(new Date(), 1).getDay();
  const ws = weekdayStats(entries)[w], all = overallAvg(entries);
  if (ws.avg == null || ws.n < 2) return { level: 'none', title: 'Өгөгдөл хуримтлагдаж байна', text: '2–3 долоо хоног тогтмол бүртгэвэл таны гаригийн хэв маягийг таамаглаж эхэлнэ.' };
  const diff = ws.avg - all;
  if (diff <= -0.4) {
    const tag = topTag(entries.filter(e => weekdayOf(e.entry_date) === w && scoreOf(e) <= 2));
    return { level: 'low', title: `Маргааш ${WD[w]} гараг: анхаарах өдөр`, text: `Өмнөх ${ws.n} ${WD[w]} гарагт таны сэтгэл санаа дунджаас ${Math.abs(diff).toFixed(1)} оноогоор доогуур байсан${tag ? ` (ихэвчлэн «${tag}»-тай холбоотой)` : ''}. Өглөө 10 минут алхаж, өдрийн дундуур 4-7-8 амьсгалын дасгал хийхийг зөвлөж байна. Өнөө орой эрт унтаарай. 🌙` };
  }
  if (diff >= 0.4) return { level: 'high', title: `Маргааш ${WD[w]} гараг: сайхан өдөр 🌤️`, text: `${WD[w]} гарагт та ихэвчлэн сайхан байдаг. Энэ эрч хүчээ ${hobby ? `«${hobby}»` : 'дуртай зүйлдээ'} зарцуулаарай!` };
  return { level: 'mid', title: `Маргааш ${WD[w]} гараг: тогтвортой өдөр`, text: 'Таны сэтгэл санаа энэ гарагт ихэвчлэн тогтвортой байдаг. Өдрөө жижиг зорилгоор эхлүүлээрэй.' };
}

export function insights(entries: Entry[]) {
  const out: string[] = [];
  const lo = mean(entries.filter(e => e.sleep != null && e.sleep < 6).map(scoreOf));
  const hi = mean(entries.filter(e => e.sleep != null && e.sleep >= 7).map(scoreOf));
  const nLo = entries.filter(e => e.sleep != null && e.sleep < 6).length, nHi = entries.filter(e => e.sleep != null && e.sleep >= 7).length;
  if (lo != null && hi != null && nLo >= 3 && nHi >= 3 && hi - lo >= 0.5)
    out.push(`😴 6 цагаас бага унтсан өдрүүдэд таны сэтгэл санаа ${Math.round(((hi - lo) / hi) * 100)}% доогуур байна.`);
  const tag = topTag(entries.filter(e => scoreOf(e) <= 2));
  if (tag) out.push(`🏷️ Хэцүү өдрүүдэд хамгийн их давтагдсан шалтгаан: «${tag}».`);
  const isWeekend = (e: Entry) => [0, 6].includes(weekdayOf(e.entry_date));
  const wk = entries.filter(isWeekend).map(scoreOf), wd = entries.filter(e => !isWeekend(e)).map(scoreOf);
  if (wk.length >= 2 && wd.length >= 2 && mean(wk)! - mean(wd)! >= 0.5) out.push('📅 Амралтын өдрүүдэд та илүү сайхан байдаг. Ажлын өдрүүдэд жижиг амралт товлоорой.');
  const s = streak(entries); if (s >= 3) out.push(`🔥 ${s} өдөр дараалан бүртгэлээ. Гайхалтай зуршил байна!`);
  if (!out.length) out.push('Илүү их бүртгэл хийх тусам ажиглалт нарийвчлагдана.');
  return out;
}

// Сүүлийн 5 бүртгэлийн дундаж маш бага бол сэтгэл зүйч санал болгоно
export const needsExpert = (entries: Entry[]) => { const l = entries.slice(-5); return l.length >= 5 && mean(l.map(scoreOf))! <= 1.6; };

export const todaysEntries = (entries: Entry[]) => entries.filter(e => e.entry_date === today()).reverse();
