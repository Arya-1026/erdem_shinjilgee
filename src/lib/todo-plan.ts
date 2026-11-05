/* ---------- Төлөвлөгөө: ажлыг тухайн хүний өгөгдөлд тулгуурлан өдрүүдэд хуваарилах ----------
   Цэвэр функцүүд (сервер, тест хоёуланд). Шийдвэрийг энэ алгоритм гаргаж, LLM зөвхөн тайлбарыг сайжруулна,
   ингэснээр огноо нь үргэлж хугацаанд багтаж, ачаалал хэтрэхгүй. */
import { MOODS, WD } from './data';
import { addDays, weekdayOf, ymd } from './date';
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

function explain(d: DayStat, t: Pick<Todo, 'effort' | 'category'>, due: string | null, date: string) {
  const day = WD[d.w], bits: string[] = [];
  const count = d.done[t.category] ?? 0;
  if (count >= 2) bits.push(`${day} гарагт та «${t.category}» төрлийн ${count} ажил дуусгаж байсан`);
  if (known(d)) {
    const mood = d.mood!.toFixed(1);
    if (t.effort === 3) bits.push(`${day} гарагт сэтгэл санаа тань дунджаар ${mood}/5${d.energy != null ? `, эрч хүч ${d.energy.toFixed(1)}/5` : ''} байдаг тул хүнд ажилд тохиромжтой`);
    else if (t.effort === 1 && d.mood! < 3) bits.push(`${day} гарагт сэтгэл санаа тань дунджаар ${mood}/5 байдаг тул хөнгөн ажил тавилаа`);
    else bits.push(`${day} гарагийн дундаж сэтгэл санаа ${mood}/5`);
  }
  if (due && due === date) bits.push('эцсийн хугацаа энэ өдөр');
  return bits.length ? `${bits.join('. ')}.` : 'Энэ гарагийн бүртгэл хараахан цөөн тул ачааллыг жигд хуваарилав. Бүртгэл нэмэгдэх тусам илүү оновчтой болно.';
}

export type Placement = { id: string; planned_date: string; reason: string };

/** Хүнд, хугацаа ойртсон ажлыг эхэлж байрлуулна. Өдрийн ачаалал хэтэрвэл дараагийн тохирох өдөр рүү шилжинэ. */
export function planTodos(tasks: Pick<Todo, 'id' | 'effort' | 'minutes' | 'category' | 'due_date'>[], stats: DayStat[], today: string, busy: Record<string, number> = {}): Placement[] {
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
    return { id: t.id, planned_date: date, reason: explain(stats[weekdayOf(date)], t, t.due_date, date) };
  });
}

export type SupportHint = { date: string; minutes: number; text: string };

/** Ойрын 7 хоногт ачаалал их, эсвэл сэтгэл санаа ихэвчлэн унадаг өдөр ажил их байвал урьдчилан анхааруулна */
export function supportHints(todos: Pick<Todo, 'planned_date' | 'minutes' | 'done'>[], stats: DayStat[], today: string): SupportHint[] {
  const start = new Date(today + 'T12:00');
  return Array.from({ length: 7 }, (_, i) => ymd(addDays(start, i))).flatMap(date => {
    const minutes = todos.filter(t => !t.done && t.planned_date === date).reduce((s, t) => s + t.minutes, 0);
    const d = stats[weekdayOf(date)], low = known(d) && d.mood! < 3;
    if (minutes < (low ? 60 : 240)) return [];
    const day = WD[d.w];
    return [{ date, minutes, text: low
      ? `${day} гарагт сэтгэл санаа тань ихэвчлэн унадаг (${d.mood!.toFixed(1)}/5), гэтэл ${minutes} минутын ажил төлөвлөгдсөн байна. Завсарлага, амьсгалын дасгал товлоорой.`
      : `${day} гарагт ${minutes} минутын ажил төлөвлөгдсөн байна. Ачаалал ихтэй тул завсарлагаа урьдчилан бодоорой.` }];
  });
}

/** LLM-д явуулах тойм: зөвхөн тоо, ажлын нэр. Тэмдэглэлийн текстийг явуулахгүй. */
export function statsSummary(stats: DayStat[]) {
  return stats.filter(known).map(d => `${WD[d.w]}: mood ${d.mood!.toFixed(1)}/5, energy ${(d.energy ?? 3).toFixed(1)}/5, ${d.n} entries`).join('\n') || 'Not enough mood data yet.';
}

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

export function parseTaskList(text: string, today: string) {
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
        reason: on ? `${FIXED}Та энэ өдрийг өөрөө заасан.` : '',
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
    { role: 'system' as const, content: `You turn a Mongolian-speaking person's free text into a task list. Today is ${today}, ${WEEKDAY_EN[weekdayOf(today)]}.
Use ONLY this calendar to pick dates, never count days yourself:
${calendarTable(today)}

Mongolian day words:
- "<weekday> гарагт", "<weekday>", "дараагийн <weekday>", "ирэх <weekday>" = the FIRST such weekday after today in the calendar.
- "дараа долоо хоногийн <weekday>" = that weekday in the rows marked "next week".
- "маргааш" = tomorrow, "нөгөөдөр" = day after tomorrow, "өнөөдөр" = today.
- If the task happens ON a day, put that date in "on". If they say "гэхэд" or "-аас өмнө" (by / before), it is a deadline: put it in "due" and leave "on" null.
- "time": HH:MM (24h) only if a clock time is given ("10 цагт" -> "10:00", "оройн 7-д" -> "19:00"), else null.
Keep titles in Mongolian, short, without the date words. category is one of: ${TODO_CATEGORIES.join(', ')}. effort: 1 light, 2 medium, 3 heavy. minutes: realistic estimate.
Reply with JSON only: {"t":[{"title":"...","category":"...","effort":2,"minutes":60,"on":null,"due":null,"time":null}]}` },
    { role: 'user' as const, content: text.slice(0, 2000) },
  ];
}

export function explainPrompt(rows: { title: string; date: string; day: string; effort: number; note: string }[], stats: string) {
  return [
    { role: 'system' as const, content: 'You are a warm Mongolian planning assistant. A scheduler already chose the dates; do not change them. For each task write one or two short Mongolian sentences explaining why that day suits this person, using only the facts given. Then write a 2-sentence Mongolian summary of the plan. Reply with JSON only: {"why":["..."],"summary":"..."} with why in the same order as the tasks.' },
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
