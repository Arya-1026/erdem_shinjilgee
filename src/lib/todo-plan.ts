/* ---------- Төлөвлөгөө: ажлыг тухайн хүний өгөгдөлд тулгуурлан өдрүүдэд хуваарилах ----------
   Цэвэр функцүүд (сервер, тест хоёуланд). Шийдвэрийг энэ алгоритм гаргаж, LLM зөвхөн тайлбарыг сайжруулна,
   ингэснээр огноо нь үргэлж хугацаанд багтаж, ачаалал хэтрэхгүй. */
import { MOODS, WD } from './data';
import { addDays, weekdayOf, ymd } from './date';
import { translator, type Locale, type Translate } from './i18n';
import type { Entry, Todo } from './types';

export const TODO_CATEGORIES = ['Ажил', 'Хичээл', 'Гэр', 'Эрүүл мэнд', 'Хувийн', 'Бүтээлч'];
export const EFFORT = [[1, 'Хөнгөн'], [2, 'Дунд'], [3, 'Хүнд']] as const;
export const effortLabel = (e: number) => EFFORT.find(([v]) => v === e)?.[1] ?? 'Дунд';
/** Төлөвлөгөөнд сонгох эможи (календарь дээр харагдана) */
export const TODO_EMOJIS = ['📚', '💼', '🏃', '🧹', '🛒', '🍽️', '☕', '🎂', '🎉', '✈️', '💊', '📞', '🎵', '❤️'];
/** Хэрэглэгч өдрийг нь өөрөө заасан ажил: дахин хуваарилахад хөдөлгөхгүй (reason-ий эхэнд тэмдэглэнэ) */
export const FIXED = '📌 ';
export const isFixed = (t: Pick<Todo, 'reason'>) => t.reason.startsWith(FIXED);
/** "HH:MM:SS" → "HH:MM" */
export const hhmm = (t: string | null) => t?.slice(0, 5) ?? '';

const HORIZON = 14, DAY_MINUTES = 180, LOW_DAY_MINUTES = 120, MIN_SAMPLES = 2;

export type DayStat = { w: number; mood: number | null; energy: number | null; sleep: number | null; n: number; done: Record<string, number> };

const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const moodScore = (id: string) => MOODS.find(m => m.id === id)?.score ?? 3;

/** Гараг бүрийн дундаж сэтгэл санаа, эрч хүч, нойр, тухайн гарагт дуусгасан ажлын тоо (ангиллаар) */
export function weekdayProfile(entries: Pick<Entry, 'entry_date' | 'mood' | 'intensity' | 'sleep'>[], history: Pick<Todo, 'category' | 'done_at'>[]): DayStat[] {
  return Array.from({ length: 7 }, (_, w) => {
    const es = entries.filter(e => weekdayOf(e.entry_date) === w);
    const done: Record<string, number> = {};
    for (const t of history) if (t.done_at && new Date(t.done_at).getDay() === w) done[t.category] = (done[t.category] ?? 0) + 1;
    return {
      w, n: es.length, done,
      mood: avg(es.map(e => moodScore(e.mood))),
      energy: avg(es.map(e => e.intensity)),
      sleep: avg(es.flatMap(e => (e.sleep == null ? [] : [e.sleep]))),
    };
  });
}

const known = (d: DayStat) => d.n >= MIN_SAMPLES && d.mood != null;

function dayScore(d: DayStat, t: Pick<Todo, 'effort' | 'category'>, offset: number) {
  // Хүнд ажил: сайн өдөр рүү, хөнгөн ажил: сул өдрийг ашиглана. Дуусгасан түүх нь хамгийн шууд баримт.
  const fit = known(d) ? ((d.mood! - 3) + ((d.energy ?? 3) - 3) * 0.5) * (t.effort - 1.5) : 0;
  return fit + Math.min(3, d.done[t.category] ?? 0) * 0.4 - offset * 0.06;
}

function explain(d: DayStat, t: Pick<Todo, 'effort' | 'category'>, due: string | null, date: string, tr: Translate) {
  const day = tr(WD[d.w]), bits: string[] = [];
  const count = d.done[t.category] ?? 0;
  if (count >= 2) bits.push(tr('{0} гарагт та «{1}» төрлийн {2} ажил дуусгаж байсан', day, tr(t.category), count));
  if (known(d)) {
    const mood = d.mood!.toFixed(1);
    if (t.effort === 3) bits.push(tr('{0} гарагт сэтгэл санаа тань дунджаар {1}/5{2} байдаг тул хүнд ажилд тохиромжтой', day, mood, d.energy != null ? tr(', эрч хүч {0}/5', d.energy.toFixed(1)) : ''));
    else if (t.effort === 1 && d.mood! < 3) bits.push(tr('{0} гарагт сэтгэл санаа тань дунджаар {1}/5 байдаг тул хөнгөн ажил тавилаа', day, mood));
    else bits.push(tr('{0} гарагийн дундаж сэтгэл санаа {1}/5', day, mood));
  }
  if (due && due === date) bits.push(tr('эцсийн хугацаа энэ өдөр'));
  return bits.length ? `${bits.join('. ')}.` : tr('Энэ гарагийн бүртгэл хараахан цөөн тул ачааллыг жигд хуваарилав. Бүртгэл нэмэгдэх тусам илүү оновчтой болно.');
}

export type Placement = { id: string; planned_date: string; reason: string };

/** Хүнд, хугацаа ойртсон ажлыг эхэлж байрлуулна. Өдрийн ачаалал хэтэрвэл дараагийн тохирох өдөр рүү шилжинэ. */
export function planTodos(tasks: Pick<Todo, 'id' | 'effort' | 'minutes' | 'category' | 'due_date'>[], stats: DayStat[], today: string, busy: Record<string, number> = {}, tr: Translate = translator('mn')): Placement[] {
  const start = new Date(today + 'T12:00');
  const days = Array.from({ length: HORIZON }, (_, i) => ymd(addDays(start, i)));
  const load: Record<string, number> = { ...busy };
  const limit = (date: string) => { const d = stats[weekdayOf(date)]; return known(d) && d.mood! < 3 ? LOW_DAY_MINUTES : DAY_MINUTES; };

  const order = [...tasks].sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || b.effort - a.effort || b.minutes - a.minutes);
  return order.map(t => {
    const open = days.filter(d => !t.due_date || d <= t.due_date);
    const options = open.length ? open : [days[0]]; // Хугацаа нь өнгөрсөн бол өнөөдөр
    const fits = options.filter(d => (load[d] ?? 0) + t.minutes <= limit(d));
    const pool = fits.length ? fits : options;
    const date = pool.reduce((best, d) => {
      const s = (x: string) => dayScore(stats[weekdayOf(x)], t, days.indexOf(x)) - (load[x] ?? 0) / 240;
      return s(d) > s(best) ? d : best;
    });
    load[date] = (load[date] ?? 0) + t.minutes;
    return { id: t.id, planned_date: date, reason: explain(stats[weekdayOf(date)], t, t.due_date, date, tr) };
  });
}

/* ---------- Ачаалал багатай хуваарилалт ----------
   Өдрийн багтаамжийг сэтгэл санаагаар тооцож, ажлыг хамгийн сул өдрүүдэд жигд тараана. */
const GENTLE_HORIZON = 21, GENTLE_MINUTES = 120, RECENT_DAYS = 3;
const EFFORT_WEIGHT: Record<number, number> = { 1: 0.7, 2: 1, 3: 1.4 };

/** Хүнд ажил нь адил хугацааны хөнгөн ажлаас илүү ядраадаг */
export const taskLoad = (t: Pick<Todo, 'minutes' | 'effort'>) => Math.round(t.minutes * (EFFORT_WEIGHT[t.effort] ?? 1));

export type RecentState = { mood: number | null; sleep: number | null; n: number };

/** Сүүлийн 3 хоногийн сэтгэл санаа, нойр: гарагийн хэв маягаас гадна яг одоогийн байдал */
export function recentState(entries: Pick<Entry, 'entry_date' | 'mood' | 'sleep'>[], today: string): RecentState {
  const from = ymd(addDays(new Date(today + 'T12:00'), -(RECENT_DAYS - 1)));
  const es = entries.filter(e => e.entry_date >= from && e.entry_date <= today);
  return { n: es.length, mood: avg(es.map(e => moodScore(e.mood))), sleep: avg(es.flatMap(e => (e.sleep == null ? [] : [e.sleep]))) };
}

const daysFrom = (today: string, date: string) => Math.round((new Date(date + 'T12:00').getTime() - new Date(today + 'T12:00').getTime()) / 864e5);
const recentLow = (date: string, today: string, r: RecentState) => daysFrom(today, date) < RECENT_DAYS && r.mood != null && r.mood < 3.2;

/** Тухайн өдөр ачаалал мэдрэгдэхгүй хийж чадах хэмжээ (жинлэсэн минут) */
export function dayCapacity(date: string, stats: DayStat[], today: string, recent: RecentState) {
  const d = stats[weekdayOf(date)];
  let c = GENTLE_MINUTES;
  if (known(d)) c *= d.mood! < 2.5 ? 0.5 : d.mood! < 3 ? 0.7 : d.mood! >= 4 ? 1.15 : 1;
  if (recentLow(date, today, recent)) c *= recent.mood! < 2.5 ? 0.5 : 0.75;
  if (daysFrom(today, date) < RECENT_DAYS && recent.sleep != null && recent.sleep < 6) c *= 0.85;
  return Math.round(c);
}

function explainGentle(date: string, t: Pick<Todo, 'effort' | 'due_date'>, stats: DayStat[], today: string, recent: RecentState, minutes: number, tr: Translate) {
  const d = stats[weekdayOf(date)], day = tr(WD[d.w]), bits: string[] = [];
  if (recentLow(date, today, recent)) bits.push(tr('Сүүлийн өдрүүдэд сэтгэл санаа тань доогуур ({0}/5) байгаа тул ойрын өдрүүдийг хөнгөвчиллөө', recent.mood!.toFixed(1)));
  if (known(d)) {
    if (d.mood! < 3) bits.push(tr('{0} гарагт сэтгэл санаа тань ихэвчлэн унадаг ({1}/5) тул энэ өдөр бага ажил тавилаа', day, d.mood!.toFixed(1)));
    else if (t.effort === 3) bits.push(tr('{0} гарагт сэтгэл санаа тань сайн ({1}/5) тул хүнд ажлыг энд тавилаа', day, d.mood!.toFixed(1)));
  }
  if (t.due_date === date) bits.push(tr('эцсийн хугацаа энэ өдөр'));
  bits.push(tr('Энэ өдрийн нийт ажил {0} минут', minutes));
  return `${bits.join('. ')}.`;
}

/**
 * Ачаалал багатай хуваарь: ажил бүрийг багтаамждаа хамгийн сул өдөрт тавина, өдөрт нэгээс олон хүнд ажил
 * өгөхгүй, сэтгэл санаа унадаг өдөр хүнд ажил тавихгүй (хугацаа шаардахаас бусад үед). busy: хөдөлгөхгүй ажлууд.
 */
export function planGentle(tasks: Pick<Todo, 'id' | 'effort' | 'minutes' | 'due_date'>[], stats: DayStat[], today: string, recent: RecentState, busy: Record<string, number> = {}, busyLoad: Record<string, number> = busy, tr: Translate = translator('mn')): Placement[] {
  const start = new Date(today + 'T12:00');
  const days = Array.from({ length: GENTLE_HORIZON }, (_, i) => ymd(addDays(start, i)));
  const cap = Object.fromEntries(days.map(d => [d, dayCapacity(d, stats, today, recent)]));
  const load: Record<string, number> = { ...busyLoad }, minutes: Record<string, number> = { ...busy };
  const heavy = new Set<string>();
  const fill = (d: string, w: number) => ((load[d] ?? 0) + w) / cap[d];

  const order = [...tasks].sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') || b.effort - a.effort || b.minutes - a.minutes);
  const placed = order.map(t => {
    const open = days.filter(d => !t.due_date || d <= t.due_date);
    const options = open.length ? open : [days[0]]; // Хугацаа нь өнгөрсөн бол өнөөдөр
    const w = taskLoad(t);
    const calm = t.effort === 3 ? options.filter(d => !heavy.has(d) && cap[d] >= GENTLE_MINUTES) : options;
    const pool = calm.length ? calm : options;
    // Хамгийн сул өдөр, тэнцвэл эртхэн нь
    const date = pool.reduce((best, d) => (fill(d, w) + days.indexOf(d) * 0.002 < fill(best, w) + days.indexOf(best) * 0.002 ? d : best));
    load[date] = (load[date] ?? 0) + w;
    minutes[date] = (minutes[date] ?? 0) + t.minutes;
    if (t.effort === 3) heavy.add(date);
    return { t, date };
  });
  return placed.map(({ t, date }) => ({ id: t.id, planned_date: date, reason: explainGentle(date, t, stats, today, recent, minutes[date], tr) }));
}

export type SupportHint = { date: string; minutes: number; text: string };

/** Ойрын 7 хоногт ачаалал их, эсвэл сэтгэл санаа ихэвчлэн унадаг өдөр ажил их байвал урьдчилан анхааруулна */
export function supportHints(todos: Pick<Todo, 'planned_date' | 'minutes' | 'done'>[], stats: DayStat[], today: string, tr: Translate = translator('mn')): SupportHint[] {
  const start = new Date(today + 'T12:00');
  return Array.from({ length: 7 }, (_, i) => ymd(addDays(start, i))).flatMap(date => {
    const minutes = todos.filter(t => !t.done && t.planned_date === date).reduce((s, t) => s + t.minutes, 0);
    const d = stats[weekdayOf(date)], low = known(d) && d.mood! < 3;
    if (minutes < (low ? 60 : 240)) return [];
    const day = tr(WD[d.w]);
    return [{ date, minutes, text: low
      ? tr('{0} гарагт сэтгэл санаа тань ихэвчлэн унадаг ({1}/5), гэтэл {2} минутын ажил төлөвлөгдсөн байна. Завсарлага, амьсгалын дасгал товлоорой.', day, d.mood!.toFixed(1), minutes)
      : tr('{0} гарагт {1} минутын ажил төлөвлөгдсөн байна. Ачаалал ихтэй тул завсарлагаа урьдчилан бодоорой.', day, minutes) }];
  });
}

/** LLM-д явуулах тойм: зөвхөн тоо, ажлын нэр. Тэмдэглэлийн текстийг явуулахгүй. */
export function statsSummary(stats: DayStat[]) {
  return stats.filter(known).map(d => `${WD[d.w]}: mood ${d.mood!.toFixed(1)}/5, energy ${(d.energy ?? 3).toFixed(1)}/5, ${d.n} entries`).join('\n') || 'Not enough mood data yet.';
}

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function parseTaskList(text: string, today: string, tr: Translate = translator('mn')) {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return [];
  const last = ymd(addDays(new Date(today + 'T12:00'), 90));
  try {
    const rows = (JSON.parse(json) as { t?: { title?: unknown; category?: unknown; effort?: unknown; minutes?: unknown; due?: unknown; on?: unknown; time?: unknown }[] }).t ?? [];
    return rows.flatMap(r => {
      const title = typeof r.title === 'string' ? r.title.trim().slice(0, 200) : '';
      if (!title) return [];
      const due = isDate(r.due) && r.due >= today ? r.due : null;
      // Хэрэглэгч тодорхой өдөр заасан бол («даваа гарагт», «маргааш») тэр өдөрт нь шууд тавина
      const on = isDate(r.on) && r.on >= today && r.on <= last ? r.on : null;
      const time = typeof r.time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(r.time) ? r.time : null;
      return [{
        title, due_date: due, planned_date: on, planned_time: time,
        reason: on ? tr('{0}Та энэ өдрийг өөрөө заасан.', FIXED) : '',
        category: TODO_CATEGORIES.includes(r.category as string) ? (r.category as string) : 'Ажил',
        effort: [1, 2, 3].includes(Number(r.effort)) ? Number(r.effort) : 2,
        minutes: Math.min(600, Math.max(5, Math.round(Number(r.minutes)) || 30)),
      }];
    }).slice(0, 20);
  } catch {
    return [];
  }
}

const WEEKDAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Ирэх 3 долоо хоногийн огноо, гараг. LLM огноог өөрөө тоолж алдахгүйн тулд хүснэгтээр өгнө. */
export function calendarTable(today: string, days = 21) {
  const start = new Date(today + 'T12:00');
  const monday = addDays(start, -((start.getDay() + 6) % 7)); // энэ долоо хоногийн Даваа
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(start, i);
    const week = Math.floor(Math.round((d.getTime() - monday.getTime()) / 864e5) / 7);
    const tag = i === 0 ? 'today' : i === 1 ? 'tomorrow (маргааш)' : i === 2 ? 'day after tomorrow (нөгөөдөр)' : ['this week', 'next week', 'in two weeks', 'in three weeks'][week];
    return `${ymd(d)} ${WEEKDAY_EN[d.getDay()]} (${WD[d.getDay()]}) - ${tag}`;
  }).join('\n');
}

export function taskPrompt(text: string, today: string) {
  return [
    { role: 'system' as const, content: `You turn a person's free text (Mongolian or English) into a task list. Today is ${today}, ${WEEKDAY_EN[weekdayOf(today)]}.
Use ONLY this calendar to pick dates, never count days yourself:
${calendarTable(today)}

Mongolian day words:
- "<weekday> гарагт", "<weekday>", "дараагийн <weekday>", "ирэх <weekday>" = the FIRST such weekday after today in the calendar.
- "дараа долоо хоногийн <weekday>" = that weekday in the rows marked "next week".
- "маргааш" = tomorrow, "нөгөөдөр" = day after tomorrow, "өнөөдөр" = today.
- English day words work the same way ("on Friday", "next Monday", "tomorrow"). "by Friday" or "before Friday" is a deadline.
- If the task happens ON a day, put that date in "on". If they say "гэхэд" or "-аас өмнө" (by / before), it is a deadline: put it in "due" and leave "on" null.
- "time": HH:MM (24h) only if a clock time is given ("10 цагт" -> "10:00", "оройн 7-д" -> "19:00"), else null.
Keep titles in the language the person wrote in, short, without the date words. category is exactly one of these values, copied as written: ${TODO_CATEGORIES.join(', ')} (work, study, home, health, personal, creative). effort: 1 light, 2 medium, 3 heavy. minutes: realistic estimate.
Reply with JSON only: {"t":[{"title":"...","category":"...","effort":2,"minutes":60,"on":null,"due":null,"time":null}]}` },
    { role: 'user' as const, content: text.slice(0, 2000) },
  ];
}

export function explainPrompt(rows: { title: string; date: string; day: string; effort: number; note: string }[], stats: string, locale: Locale = 'mn') {
  const lang = locale === 'en' ? 'English' : 'Mongolian';
  return [
    { role: 'system' as const, content: `You are a warm ${lang}-speaking planning assistant. A scheduler already chose the dates; do not change them. For each task write one or two short ${lang} sentences explaining why that day suits this person, using only the facts given. Then write a 2-sentence ${lang} summary of the plan. Reply with JSON only: {"why":["..."],"summary":"..."} with why in the same order as the tasks.` },
    { role: 'user' as const, content: `Their weekly pattern:\n${stats}\n\nPlan:\n${rows.map((r, i) => `${i}. ${r.title} → ${r.day} ${r.date}, effort ${r.effort}/3. Facts: ${r.note}`).join('\n')}` },
  ];
}

export function parseExplain(text: string, count: number) {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  try {
    const j = JSON.parse(json) as { why?: unknown; summary?: unknown };
    const why = Array.isArray(j.why) ? j.why.map(w => (typeof w === 'string' ? w.trim().slice(0, 300) : '')) : [];
    return { why: why.length === count ? why : [], summary: typeof j.summary === 'string' ? j.summary.trim().slice(0, 500) : '' };
  } catch {
    return null;
  }
}
