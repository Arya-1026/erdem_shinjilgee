/* ---------- Өдрийн сэтгэл санааны дэмжлэг (LLM) ----------
   Хэрэглэгчийн өнөөдрийн бүртгэл (mood, эрчим, шалтгаан, нойр, тэмдэглэл), сүүлийн 7 хоног, хоббид тулгуурлан
   богино, дулаахан дэмжлэгийн үг + өнөөдөр хийж болох 3 жижиг алхам гаргана. */
import { moodById, RECS, SUPPORT } from './data';
import { translator, type Locale } from './i18n';
import type { Entry, MoodId } from './types';

export type Support = { message: string; steps: string[] };

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
export { isDate as isSupportDate };

export function supportPrompt(p: { name: string; hobbies: string[]; today: Entry[]; recent: Entry[]; weekday: string; locale?: Locale }) {
  if (p.locale === 'en') return supportPromptEn(p);
  const fmt = (e: Entry) => `${e.entry_date} ${e.entry_time}: ${moodById(e.mood).label} (эрч хүч ${e.intensity}/5${e.sleep != null ? `, нойр ${e.sleep} цаг` : ''}${e.tags.length ? `, холбоотой: ${e.tags.join(', ')}` : ''})`;
  const notes = p.today.map(e => e.note.trim()).filter(Boolean).join(' / ').slice(0, 800);
  const user = [
    `Нэр: ${p.name || 'хэрэглэгч'}. Хобби: ${p.hobbies.join(', ') || 'тодорхойгүй'}. Өнөөдөр ${p.weekday} гараг.`,
    `Өнөөдрийн бүртгэл:\n${p.today.map(fmt).join('\n')}`,
    notes ? `Өнөөдрийн тэмдэглэл (хэрэглэгч өөрөө бичсэн): «${notes}»` : '',
    p.recent.length ? `Сүүлийн өдрүүд:\n${p.recent.map(fmt).join('\n')}` : '',
    'Энэ хүнд өнөөдрийн сэтгэл санааг нь дэмжих богино захидал бич.',
    'Шаардлага: монгол хэлээр, дулаахан, хүндэтгэлтэй, 2–4 өгүүлбэр. Мэдрэмжийг нь нэрлэж хүлээн зөвшөөр, буруутгахгүй, "зүгээр л баярла" гэх мэт үгүйсгэх үг хэрэглэхгүй.',
    'Дараа нь өнөөдөр хийж болох 3 жижиг, тодорхой алхам (тус бүр 12 үгээс бага). Хоббиг нь ашигла, сүүлийн өдрүүдийн хэв маягийг (нойр, шалтгаан) анхаар.',
    'Эмч биш тул онош, эм санал болгохгүй. Хүнд байдал удаан үргэлжилж байвал апп-ын «Сэтгэл зүйчид» хэсгийг зөөлөн санал болгож болно.',
    'Зөвхөн JSON: {"msg":"...","steps":["...","...","..."]}',
  ].filter(Boolean).join('\n\n');
  return [
    { role: 'system' as const, content: 'Чи бол «Сэтгэл» апп-ын халамжтай, мэргэжлийн сэтгэл зүйн дэмжлэг үзүүлэгч туслах. Богино, бодитой, хүнлэг бич.' },
    { role: 'user' as const, content: user },
  ];
}

/** Англи хэлтэй хэрэглэгчид: бүртгэлийн утгыг англиар өгч, хариуг англиар авна */
function supportPromptEn(p: { name: string; hobbies: string[]; today: Entry[]; recent: Entry[]; weekday: string }) {
  const tr = translator('en');
  const fmt = (e: Entry) => `${e.entry_date} ${e.entry_time}: ${tr(moodById(e.mood).label)} (energy ${e.intensity}/5${e.sleep != null ? `, slept ${e.sleep} h` : ''}${e.tags.length ? `, related to: ${e.tags.map(t => tr(t)).join(', ')}` : ''})`;
  const notes = p.today.map(e => e.note.trim()).filter(Boolean).join(' / ').slice(0, 800);
  const user = [
    `Name: ${p.name || 'user'}. Hobbies: ${p.hobbies.map(h => tr(h)).join(', ') || 'unknown'}. Today is ${tr(p.weekday)}.`,
    `Today's entries:\n${p.today.map(fmt).join('\n')}`,
    notes ? `Today's note (written by the user): «${notes}»` : '',
    p.recent.length ? `Recent days:\n${p.recent.map(fmt).join('\n')}` : '',
    'Write this person a short note supporting how they feel today.',
    'Requirements: in English, warm and respectful, 2-4 sentences. Name their feeling and accept it. Do not blame, and do not dismiss it with phrases like "just cheer up".',
    'Then give 3 small, concrete steps they could do today (each under 12 words). Use their hobbies and notice recent patterns (sleep, causes).',
    'You are not a doctor: no diagnosis, no medication. If a heavy state has lasted a long time, you may gently suggest the app\'s "Psychologists" section.',
    'JSON only: {"msg":"...","steps":["...","...","..."]}',
  ].filter(Boolean).join('\n\n');
  return [
    { role: 'system' as const, content: 'You are the caring, professional psychological support assistant in a mood app. Write briefly, honestly and humanly.' },
    { role: 'user' as const, content: user },
  ];
}

export function parseSupport(text: string): Support | null {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  try {
    const j = JSON.parse(json) as { msg?: unknown; steps?: unknown };
    const message = typeof j.msg === 'string' ? j.msg.trim().slice(0, 900) : '';
    const steps = Array.isArray(j.steps) ? j.steps.filter((x): x is string => typeof x === 'string' && Boolean(x.trim())).map(x => x.trim().slice(0, 140)).slice(0, 4) : [];
    return message ? { message, steps } : null;
  } catch {
    return null;
  }
}

/** LLM байхгүй/унасан үед: тухайн mood-ийн бэлэн үг + хоббид тохирох дасгалуудаас алхам */
export function fallbackSupport(mood: MoodId, hobbies: string[], locale: Locale = 'mn'): Support {
  const tr = translator(locale);
  const recs = RECS.filter(r => r.type === 'exercise' && r.moods.includes(mood))
    .sort((a, b) => Number((b.hobby ?? []).some(h => hobbies.includes(h))) - Number((a.hobby ?? []).some(h => hobbies.includes(h))));
  const steps = recs.slice(0, 2).map(r => `${tr(r.title)} (${tr(r.sub).split('·')[0].trim()})`);
  steps.push(tr(['sad', 'anxious', 'angry', 'tired'].includes(mood) ? 'Итгэдэг нэг хүндээ богино мессеж бичээрэй' : 'Энэ сайхан мөчийг тэмдэглэлдээ бичээрэй'));
  return { message: tr(SUPPORT[mood]), steps };
}
