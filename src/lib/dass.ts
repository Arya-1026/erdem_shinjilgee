/* ---------- DASS-21 (Depression Anxiety Stress Scales, Lovibond & Lovibond 1995) ----------
   Нийтэд нээлттэй асуулга (psy.unsw.edu.au/dass). 21 өгүүлбэр, сүүлийн 7 хоногийг асууна, хариулт бүр 0–3.
   Гутрал, Түгшүүр, Стресс тус бүр 7 асуулт. Дэд оноог ×2 хийж 42 асуулттай хувилбартай харьцуулна.
   ⚠️ Монгол орчуулга нь ТҮР орчуулга: баталгаажсан орчуулга олдвол DASS_ITEMS-ийн `mn`-ийг солино.
   Энэ нь скрининг, онош биш. */

export type DassScale = 'depression' | 'anxiety' | 'stress';
export type DassLevel = 'normal' | 'mild' | 'moderate' | 'severe' | 'extreme';

/** Асуултын дараалал албан ёсны маягтынхтай ижил (1–21). `scale`: аль дэд хэмжүүрт орох. */
export const DASS_ITEMS: { scale: DassScale; mn: string }[] = [
  { scale: 'stress', mn: 'Сэтгэлээ намжааж, тайвшрахад хэцүү байсан' },
  { scale: 'anxiety', mn: 'Ам хатаж байгааг мэдэрч байсан' },
  { scale: 'depression', mn: 'Ямар ч эерэг, сайхан мэдрэмж төрөхгүй байх шиг санагдсан' },
  { scale: 'anxiety', mn: 'Хүч гаргаагүй байхад ч амьсгал давчдах, хэт түргэн амьсгалах үе гарсан' },
  { scale: 'depression', mn: 'Аливаа зүйлийг хийж эхлэх хүсэл, эрч гаргахад хэцүү байсан' },
  { scale: 'stress', mn: 'Аливаа нөхцөл байдалд хэтэрхий хүчтэй хариу үйлдэл үзүүлдэг байсан' },
  { scale: 'anxiety', mn: 'Бие (жишээ нь гар) чичрэх үе гарсан' },
  { scale: 'stress', mn: 'Байнга сандарч, мэдрэлээ их чангалж байгаагаа мэдэрсэн' },
  { scale: 'anxiety', mn: 'Сандарч, бусдын өмнө ичгэвтэр байдалд орох вий гэж санаа зовж байсан' },
  { scale: 'depression', mn: 'Хүлээн тэсэн ядах, баярлан хүлээх зүйл алга мэт санагдсан' },
  { scale: 'stress', mn: 'Амархан цухалдаж, тайван бус болдгоо анзаарсан' },
  { scale: 'stress', mn: 'Амарч, биеэ сулруулахад хэцүү байсан' },
  { scale: 'depression', mn: 'Сэтгэл гутарч, гунигтай байсан' },
  { scale: 'stress', mn: 'Хийж буй ажилд минь саад болох бүх зүйлд тэвчээргүй ханддаг байсан' },
  { scale: 'anxiety', mn: 'Сандралд автахад ойрхон байгаа юм шиг санагдсан' },
  { scale: 'depression', mn: 'Юунд ч сонирхол, урам орохгүй байсан' },
  { scale: 'depression', mn: 'Хүний хувьд өөрийгөө төдийлөн үнэ цэнэгүй гэж бодож байсан' },
  { scale: 'stress', mn: 'Амархан гомдож, эмзэглэдэг байсан' },
  { scale: 'anxiety', mn: 'Хүч гаргаагүй байхад ч зүрхнийхээ цохилтыг мэдэрч байсан (зүрх хурдан цохилох, цохилт алгасах)' },
  { scale: 'anxiety', mn: 'Тодорхой шалтгаангүйгээр айж байсан' },
  { scale: 'depression', mn: 'Амьдрал утга учиргүй мэт санагдсан' },
];

export const DASS_COUNT = DASS_ITEMS.length;
/** «Амьдрал утга учиргүй» (21-р асуулт): өндөр бол түвшингээс үл хамааран тусламжийн мэдээлэл харуулна */
export const MEANING_ITEM = 20;

export const DASS_CHOICES = [
  'Огт тохиолдоогүй',
  'Заримдаа, бага зэрэг тохиолдсон',
  'Нэлээд олон удаа тохиолдсон',
  'Ихэнх үед, маш их тохиолдсон',
] as const;

export const DASS_SCALES: DassScale[] = ['depression', 'anxiety', 'stress'];
export const SCALE_LABEL: Record<DassScale, string> = { depression: 'Гутрал', anxiety: 'Түгшүүр', stress: 'Стресс' };
export const LEVEL_LABEL: Record<DassLevel, string> = { normal: 'Хэвийн', mild: 'Хөнгөн', moderate: 'Дунд', severe: 'Хүнд', extreme: 'Маш хүнд' };
export const LEVELS: DassLevel[] = ['normal', 'mild', 'moderate', 'severe', 'extreme'];

/** Түвшний доод босго (×2 хийсний дараах оноо): [хөнгөн, дунд, хүнд, маш хүнд] */
const CUTS: Record<DassScale, [number, number, number, number]> = {
  depression: [10, 14, 21, 28],
  anxiety: [8, 10, 15, 20],
  stress: [15, 19, 26, 34],
};
export const DASS_MAX = 42;

export type DassScores = Record<DassScale, number>;

export function scoreDass(answers: number[]): DassScores {
  if (answers.length !== DASS_COUNT || answers.some(a => !Number.isInteger(a) || a < 0 || a > 3)) throw new Error('DASS-21: 21 хариулт (0–3) шаардлагатай');
  const s: DassScores = { depression: 0, anxiety: 0, stress: 0 };
  answers.forEach((a, i) => { s[DASS_ITEMS[i].scale] += a; });
  return { depression: s.depression * 2, anxiety: s.anxiety * 2, stress: s.stress * 2 };
}

export function dassLevel(scale: DassScale, score: number): DassLevel {
  const c = CUTS[scale];
  return score >= c[3] ? 'extreme' : score >= c[2] ? 'severe' : score >= c[1] ? 'moderate' : score >= c[0] ? 'mild' : 'normal';
}

/** Мэргэжлийн тусламжийн мэдээллийг харуулах эсэх: аль нэг нь «Хүнд»+ эсвэл 21-р асуултад 2+ */
export function needsHelp(scores: DassScores, answers?: number[]) {
  return DASS_SCALES.some(k => ['severe', 'extreme'].includes(dassLevel(k, scores[k]))) || (answers?.[MEANING_ITEM] ?? 0) >= 2;
}

/** Түвшинд тохирсон апп доторх дасгалууд (lib/data.ts RECS-ийн id) */
export const DASS_RECS: Record<DassScale, string[]> = {
  anxiety: ['e1', 'e6', 'e2'], // 4-7-8 амьсгал, булчин суллах, 5-4-3-2-1
  depression: ['e3', 'e5', 'e8'], // алхалт, талархал, мэдрэмжээ зураглах
  stress: ['e4', 'e9', 'e6'], // иог, ачааллаа задлах, булчин суллах
};

/** Дахин бөглөхийг санал болгох хугацаа (DASS сүүлийн 7 хоногийг асуудаг) */
export const DASS_RETAKE_DAYS = 14;
