/* ---------- DASS-21 (Depression Anxiety Stress Scales, Lovibond & Lovibond 1995) ----------
   Нийтэд нээлттэй асуулга (psy.unsw.edu.au/dass). 21 өгүүлбэр, сүүлийн 7 хоногийг асууна, хариулт бүр 0–3.
   Гутрал, Түгшүүр, Стресс тус бүр 7 асуулт. Дэд оноог ×2 хийж 42 асуулттай хувилбартай харьцуулна.
   Монгол асуулт, хариултын сонголт нь «DASS-21 Mongolian» маягтаас үгчлэн авсан тул бүү засварлана.
   Энэ нь скрининг, онош биш. */

export type DassScale = 'depression' | 'anxiety' | 'stress';
export type DassLevel = 'normal' | 'mild' | 'moderate' | 'severe' | 'extreme';

/** Асуултын дараалал албан ёсны маягтынхтай ижил (1–21). `scale`: аль дэд хэмжүүрт орох. */
export const DASS_ITEMS: { scale: DassScale; mn: string }[] = [
  { scale: 'stress', mn: 'Тайвширч чадахгүй байгаагаа олж мэдсэн' },
  { scale: 'anxiety', mn: 'Ам хатахыг мэдэрсэн' },
  { scale: 'depression', mn: 'Бүх зүйлээс ямар нэг эерэг мэдрэмж авч чадахгүй буй мэт санагдсан' },
  { scale: 'anxiety', mn: 'Амьсгалахад төвөгтэй болж байсан (Ялангуяа хэт их амьсгаадах, биеийн ачаалал аваагүй байхад амьсгаадах)' },
  { scale: 'depression', mn: 'Санаачлага гарган аливаа зүйлийг хийх ажиллахад хэцүү байсан' },
  { scale: 'stress', mn: 'Би нөхцөл байдалд хэт хариу урвал үзүүлэх хандлагатай байсан' },
  { scale: 'anxiety', mn: 'Би салгалж чичирч байсан (жишээ нь гар)' },
  { scale: 'stress', mn: 'Би их хэмжээний мэдрэлийн хүч зарцуулж байгаагаа мэдэрч байсан' },
  { scale: 'anxiety', mn: 'Өөрийгөө эвгүй байдалд оруулах, сандарч самгардаж магадгүй нөхцөл байдлын тухай санаа зовж байсан' },
  { scale: 'depression', mn: 'Надад хүсэн хүлээх зүйл юу ч байхгүй мэт мэдрэгдэж байсан' },
  { scale: 'stress', mn: 'Өөрийнхөө хямарсан, түгшсэн байгааг олж мэдэж байсан' },
  { scale: 'stress', mn: 'Тайвшрахад хэцүү байгаагаа мэдэрч байсан' },
  { scale: 'depression', mn: 'Би уруу царайтай, гутарсан байгаагаа мэдэрч байсан' },
  { scale: 'stress', mn: 'Би хийж байсан юмаа дуусгахад саад болсон зүйлийг тэвчиж чадаагүй' },
  { scale: 'anxiety', mn: 'Би учраа олохгүй байдалд ороход ойр байгааг мэдэрч байсан' },
  { scale: 'depression', mn: 'Би ямар нэгэн зүйлд урам зоригтой байх боломжгүй байсан' },
  { scale: 'depression', mn: 'Би хүн шиг үнэ цэнэтэй биш мэт мэдэрч байсан' },
  { scale: 'stress', mn: 'Би хэтэрхий түргэн ууртай болсон' },
  { scale: 'anxiety', mn: 'Биеийн ачаалал аваагүй боловч зүрх дэлсэхийг мэдэрч байсан (зүрхний агшилт түргэссэн эсвэл зүрх зогссон мэт мэдрэгдэх)' },
  { scale: 'anxiety', mn: 'Ямар нэг тодорхой шалтгаангүйгээр айдас хүрч байсан' },
  { scale: 'depression', mn: 'Амьдрал утгагүй мэт мэдрэгдсэн' },
];

export const DASS_COUNT = DASS_ITEMS.length;
/** «Амьдрал утга учиргүй» (21-р асуулт): өндөр бол түвшингээс үл хамааран тусламжийн мэдээлэл харуулна */
export const MEANING_ITEM = 20;

export const DASS_CHOICES = [
  'Надад тохиолдоогүй',
  'Надад заримдаа буюу бага хэмжээгээр тохиолдсон',
  'Надад тодорхой хэмжээгээр буюу тодорхой хугацаанд тохиолдсон',
  'Надад маш олон тохиолдсон буюу ихэвчлэн тохиолддог',
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
  anxiety: ['e1', 'e11', 'e17', 'e2'], // 4-7-8 амьсгал, хайрцаг амьсгал, бодлоо шалгах, 5-4-3-2-1
  depression: ['e3', 'e14', 'e19', 'e5'], // алхалт, өөртөө захидал, хайртай хүндээ мессеж, талархал
  stress: ['e12', 'e9', 'e15', 'e6'], // бие сканнердах, ачааллаа задлах, нойрны өмнөх тайвшрал, булчин суллах
};

/** Дахин бөглөхийг санал болгох хугацаа (DASS сүүлийн 7 хоногийг асуудаг) */
export const DASS_RETAKE_DAYS = 14;

/** Дахин бөглөх хүртэл үлдсэн өдөр. 0 бол одоо бөглөж болно (14 хоногт нэг удаа, 0024_dass_interval.sql мөн шалгана). */
export function dassDaysLeft(lastAt: string | null | undefined, now = Date.now()) {
  if (!lastAt) return 0;
  return Math.max(0, Math.ceil((new Date(lastAt).getTime() + DASS_RETAKE_DAYS * 864e5 - now) / 864e5));
}
/** Сервер 14 хоногийн дотор дахин бөглөхийг татгалзсан эсэх */
export const isDassIntervalError = (msg: string | undefined) => Boolean(msg?.includes('dass_interval'));

/* ---------- Үр дүнгийн тайлбар ---------- */
/** Хэмжүүр бүр юуг хэмждэг вэ */
export const SCALE_DESC: Record<DassScale, string> = {
  depression: 'Урам зориг, баяр баясгалан алдагдах, ирээдүйд найдваргүй санагдах, өөрийгөө үнэлэх байдал буурахыг хэмжинэ.',
  anxiety: 'Бие махбодын түгшүүр (зүрх дэлсэх, ам хатах, чичрэх), айдас, сандрах мэдрэмжийг хэмжинэ.',
  stress: 'Тайвширч чадахгүй байх, амархан уурлах, бухимдах, байнгын дарамттай байх мэдрэмжийг хэмжинэ.',
};

/** Түвшний бүлэг: тайлбарыг 3 бүлгээр өгнө */
export type LevelBand = 'low' | 'mid' | 'high';
export const levelBand = (lv: DassLevel): LevelBand => (lv === 'normal' || lv === 'mild' ? 'low' : lv === 'moderate' ? 'mid' : 'high');

/** Түвшин юу гэсэн үг вэ, анхаарахгүй бол ямар үр дагавартай вэ */
export const DASS_EXPLAIN: Record<DassScale, Record<LevelBand, { meaning: string; risk: string }>> = {
  depression: {
    low: {
      meaning: 'Таны сэтгэл санаа ерөнхийдөө тогтвортой байна. Хааяа гунигтай байх нь хэвийн үзэгдэл.',
      risk: 'Онцгой эрсдэл алга. Нойр, хөдөлгөөн, ойр дотны хүмүүстэйгээ харилцахаа хадгалаарай.',
    },
    mid: {
      meaning: 'Сүүлийн үед урам зориг, баяр баясгалан мэдэгдэхүйц буурсан байна.',
      risk: 'Анхаарахгүй орхивол хичээл, ажилдаа төвлөрөх, нойр, хоолны дуршил муудаж, хүмүүсээс хөндийрөх хандлагатай. 2 долоо хоногоос удаан үргэлжилбэл сэтгэл зүйчтэй зөвлөлдөөрэй.',
    },
    high: {
      meaning: 'Гутралын шинж тэмдэг өндөр байна. Энэ нь таны буруу биш, туслалцаа авах шаардлагатай гэсэн дохио.',
      risk: 'Эмчлэхгүй бол гутрал удаан үргэлжилж, өдөр тутмын амьдрал, харилцаа, эрүүл мэндэд ноцтой нөлөөлж, өөрийгөө гэмтээх бодол төрөх эрсдэлтэй. Мэргэжлийн хүнтэй аль болох хурдан холбогдоорой.',
    },
  },
  anxiety: {
    low: {
      meaning: 'Түгшүүр хэвийн хэмжээнд байна. Шалгалт, шинэ нөхцөлд бага зэрэг сандрах нь байгалийн хариу үйлдэл.',
      risk: 'Онцгой эрсдэл алга. Амьсгалын дасгал зэрэг тайвшрах аргуудаа хэвээр хэрэглээрэй.',
    },
    mid: {
      meaning: 'Түгшүүр, сандрал таны өдөр тутмын амьдралд мэдрэгдэхүйц нөлөөлж эхэлсэн байна.',
      risk: 'Анхаарахгүй бол зүрх дэлсэх, толгой өвдөх, нойргүйдэх зэрэг биеийн шинж тэмдэг нэмэгдэж, айдас төрүүлэх нөхцөлөөс зайлсхийх зуршил тогтох магадлалтай.',
    },
    high: {
      meaning: 'Түгшүүрийн шинж тэмдэг өндөр байна. Сандралын дайралт (panic) ч тохиолдож болох түвшин.',
      risk: 'Эмчлэхгүй бол түгшүүр архаг болж, сургууль, ажил, нийгмийн харилцаагаа хязгаарлах, бие махбодын өвчинд хүргэх эрсдэлтэй. Сэтгэл зүйчтэй яаралтай холбогдоорой.',
    },
  },
  stress: {
    low: {
      meaning: 'Стрессээ сайн зохицуулж байна.',
      risk: 'Онцгой эрсдэл алга. Ажил, амралтын тэнцвэрээ хадгалаарай.',
    },
    mid: {
      meaning: 'Байнгын дарамт, бухимдал мэдрэгдэхүйц нэмэгдсэн байна.',
      risk: 'Удаан үргэлжилбэл ядаргаа (burnout), нойргүйдэл, дархлаа суларч, хүмүүстэй муудалцах нь ихсэх хандлагатай. Ачааллаа бууруулж, амрах цаг гаргаарай.',
    },
    high: {
      meaning: 'Стресс маш өндөр байна. Бие, сэтгэл хоёулаа хэт ачаалалтай байгааг илтгэнэ.',
      risk: 'Анхаарахгүй бол бүрэн ядаргаа, зүрх судасны асуудал, гутрал, түгшүүр үүсэх эрсдэлтэй. Мэргэжлийн хүнээс тусламж аваарай.',
    },
  },
};

/** Сэтгэл зүйчтэй холбогдохыг санал болгох зэрэг: urgent = яаралтай, suggest = зөвлөлдөхийг санал болгоно */
export function helpLevel(scores: DassScores, answers?: number[]): 'urgent' | 'suggest' | null {
  if (needsHelp(scores, answers)) return 'urgent';
  return DASS_SCALES.some(k => dassLevel(k, scores[k]) === 'moderate') ? 'suggest' : null;
}
