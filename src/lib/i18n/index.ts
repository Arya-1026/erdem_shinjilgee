/* ---------- Хэлний тохиргоо (монгол, англи) ----------
   Монгол бичвэр нь түлхүүр: кодонд tr('Хадгалах') гэж бичээд англи орчуулгыг en.ts-д нэмнэ.
   Орчуулга дутвал монголоор харагдана. Хувьсагчийг {0}, {1} гэж тэмдэглэнэ: tr('{0} дуу', n).
   Сервер, клиент хоёуланд ажиллана. Клиентэд useT(), сервер дээр translator(await requestLocale()). */
import { EN } from './en';

export const LOCALES = ['mn', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'mn';
export const LOCALE_COOKIE = 'setgel-lang';
/** Хэл бүрийн өөрийн нэр: аль хэлтэй хүн ч хэлээ таньж сонгоно */
export const LOCALE_NAMES: Record<Locale, string> = { mn: 'Монгол', en: 'English' };
export const LOCALE_FLAGS: Record<Locale, string> = { mn: '🇲🇳', en: '🇬🇧' };

export const isLocale = (v: unknown): v is Locale => v === 'mn' || v === 'en';

type Arg = string | number | null | undefined | false;
export type Translate = (text: string, ...args: Arg[]) => string;

const fill = (text: string, args: Arg[]) =>
  args.length ? text.replace(/\{(\d+)\}/g, (_, i) => { const v = args[Number(i)]; return v == null || v === false ? '' : String(v); }) : text;

// Монголд нэр үг тоогоор хувирдаггүй тул англи түлхүүр нэг хэлбэртэй: "1 tasks" → "1 task"
const SINGULAR: Record<string, string> = { tasks: 'task', songs: 'song', entries: 'entry', rounds: 'round', times: 'time', days: 'day', playlists: 'playlist', minutes: 'minute', hours: 'hour' };
const singular = (s: string) => s.replace(/(?<![\d.])1 (tasks|songs|entries|rounds|times|days|playlists|minutes|hours)\b/g, (_, w: string) => `1 ${SINGULAR[w]}`);

const TRANSLATORS: Record<Locale, Translate> = {
  mn: (text, ...args) => fill(text, args),
  en: (text, ...args) => singular(fill(EN[text] ?? text, args)),
};

export const translator = (locale: Locale) => TRANSLATORS[locale];

/**
 * Энэ төхөөрөмжийн сонголт (cookie) ба профайлын хэлийг тааруулна. Сонгосон хэл давуу: нэвтэрсний дараа солигдохгүй.
 * Профайлын хэл зөвхөн энэ төхөөрөмж дээр сонголт хийгээгүй үед хэрэглэгдэнэ.
 */
export function languageSync(picked: boolean, saved: Locale | null, current: Locale): { use?: Locale; save?: Locale } {
  if (!picked) return saved ? { use: saved } : {};
  return saved === current ? {} : { save: current };
}

const CYRILLIC = /\p{Script=Cyrillic}/u;

/** Бичвэрийн хэл: үгийн тоогоор. Англи өгүүлбэр дэх кирилл нэр хэлийг өөрчлөхгүй. Үсэггүй бол null. */
export function writtenIn(text: string): Locale | null {
  const mn = text.match(/\p{Script=Cyrillic}{2,}/gu)?.length ?? 0, en = text.match(/[A-Za-z]{2,}/g)?.length ?? 0;
  return !mn && !en ? null : mn > en ? 'mn' : 'en';
}
/** Бичвэр сонгосон хэлтэй таарч байна уу (үсэггүй бол таарсан гэж үзнэ) */
export const matchesLocale = (text: string, locale: Locale) => (writtenIn(text) ?? locale) === locale;

/**
 * Хадгалагдсан шалтгааны бичвэр ("💙 Гунигт чинь нийцэх: Таны дуртай дуучин").
 * Хэсэг бүрийг орчуулна. Англи үед AI-ийн монголоор бичсэн хэсэг үлдвэл харуулахгүй.
 */
export function translateReason(locale: Locale, reason: string) {
  const t = translator(locale);
  const parts = reason.split(': ').map(p => { const h = p.match(/^«(.+)» хоббид тань$/); return h ? t('«{0}» хоббид тань', t(h[1])) : t(p); });
  // AI-ийн өөр хэлээр бичсэн тайлбарыг харуулахгүй (монгол үед "Lo-fi" зэрэг нэрс үлдэнэ, зөвхөн өгүүлбэрийг хасна)
  return (locale === 'en' ? parts.filter(p => !CYRILLIC.test(p)) : parts.filter(p => CYRILLIC.test(p) || p.split(' ').length < 3)).join(': ');
}
