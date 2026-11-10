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
  ].filter(Boolean).join('\n\n');
  return [{ role: 'system' as const, content: MN_SYSTEM }, { role: 'user' as const, content: user }];
}

// Жижиг загвар утгагүй, орчуулсан мэт өгүүлбэр гаргадаг байсан тул найруулгын дүрэм, сайн жишээг тодорхой өгнө
const MN_SYSTEM = `Чи бол «Сэтгэл» апп-ын халамжтай сэтгэл зүйн туслах. Хэрэглэгчийн өнөөдрийн бүртгэлийг уншаад түүнд богино дэмжлэгийн үг, өнөөдөр хийж болох 3 жижиг алхам бич.

Хэл найруулга:
- Энгийн, ярианы монгол хэлээр, найздаа хэлж байгаа юм шиг бич. Англиас орчуулсан мэт хэллэг, зохиомол үг бүү хэрэглэ.
- Богино, ойлгомжтой өгүүлбэр. Үйл үг өгүүлбэрийн төгсгөлд. Хүнийг «чи» гэж хандана.
- Бичсэн өгүүлбэр бүр утгатай, бодит байх ёстой. Утга нь эргэлзээтэй бол илүү энгийн үгээр бич.

Дэмжлэгийн үг (msg): 2–3 өгүүлбэр. Өнөөдрийн сэтгэл санааг нэрээр нь дурдаж хүлээн зөвшөөр. Бүртгэлээс нэг бодит зүйлийг (нойр, шалтгаан, тэмдэглэл, сүүлийн өдрүүдийн өөрчлөлт) холбож хэл. Бүртгэлд байхгүй зүйл бүү зохио. Буруутгахгүй, «зүгээр л баярла» гэх мэт мэдрэмжийг үгүйсгэхгүй.

Алхам (steps): 3 ширхэг, тус бүр 4–10 үг, тушаах хэлбэрээр («...-аарай», «...-ж үз»). Хэн ч шууд ойлгох тодорхой үйлдэл, хугацаатай бол минутаар. Дор хаяж нэг алхам нь хэрэглэгчийн хоббид тулгуурласан байна (жишээ нь гитар тоглодог бол «Дуртай дуугаа гитар дээр тоглоорой», хоол хийх дуртай бол «Шинэ жор туршиж үзээрэй»). Дугаар, тэмдэг бүү нэм.
Жишээ сайн алхам: «10 минут гадуур алхаарай», «Дуртай дуугаа сонсоод амраарай», «Унтахаасаа өмнө утсаа холдуулаарай».

Жишээ сайн дэмжлэгийн үг: «Өнөөдөр тайван байгаа чинь сайхан байна. Өмнөх өдрүүдэд ядарсан байсан ч 7 цаг унтсан чинь нөлөөлсөн байх. Энэ тайван байдлаа өөртөө зориулж ашиглаарай.»

Эмч биш тул онош, эм санал болгохгүй. Хүнд байдал удаан үргэлжилбэл апп-ын «Сэтгэл зүйчид» хэсгийг зөөлөн санал болгож болно.

Буцаахаасаа өмнө өгүүлбэр бүрийг дахин уншаад шалга: давхардсан үг («амар амар»), монголд байхгүй үг, утга нь ойлгомжгүй хэллэг байвал энгийн үгээр соль.

Зөвхөн JSON буцаа: {"msg":"...","steps":["...","...","..."]}`;

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
    'Then give 3 small, concrete steps they could do today (each under 12 words). At least one step must come from their hobbies (e.g. likes guitar → play a favorite song; likes cooking → try a new recipe). Notice recent patterns (sleep, causes).',
    'You are not a doctor: no diagnosis, no medication. If a heavy state has lasted a long time, you may gently suggest the app\'s "Psychologists" section.',
    'JSON only: {"msg":"...","steps":["...","...","..."]}',
  ].filter(Boolean).join('\n\n');
  return [
    { role: 'system' as const, content: 'You are the caring, professional psychological support assistant in a mood app. Write briefly, honestly and humanly.' },
    { role: 'user' as const, content: user },
  ];
}

/** Найруулгын засварт нэг текст болгож өгөөд буцааж задална: мөр бүр нэг алхам */
export const joinSupport = (s: Support) => [s.message, ...s.steps.map(x => '- ' + x)].join('\n');
export function splitSupport(text: string, like: Support): Support | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const steps = lines.filter(l => /^[-•*]\s/.test(l)).map(l => l.replace(/^[-•*]\s+/, ''));
  const message = lines.filter(l => !/^[-•*]\s/.test(l)).join(' ');
  return message && steps.length === like.steps.length ? { message, steps } : null;
}

export function parseSupport(text: string): Support | null {
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;
  try {
    const j = JSON.parse(json) as { msg?: unknown; steps?: unknown };
    const message = typeof j.msg === 'string' ? j.msg.trim().slice(0, 900) : '';
    const steps = Array.isArray(j.steps) ? j.steps.filter((x): x is string => typeof x === 'string' && Boolean(x.trim())).map(x => x.replace(/^\s*(?:\d+\s*[.)]|\d+(?=\p{L})|[-•*])\s*/u, '').trim().slice(0, 140)).filter(Boolean).slice(0, 4) : [];
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
