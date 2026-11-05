/* ---------- Уран бүтээлчид ----------
   Нас, төрлөөр сонголт гаргах жагсаалт. Дуунуудыг нь эндээс биш, Spotify-аас уран бүтээлчээр нь хайж авна
   (server/spotify-search.ts → artistSongs), тиймээс шинэ дуу нь автоматаар орж ирнэ. */
import type { Genre } from './mn-songs';

export type AgeGroup = 'teen' | 'young' | 'adult' | 'mature' | 'senior';

/** 13-17, 18-24, 25-39, 40-54, 55+ */
export function ageGroup(birthYear: number | null | undefined, year = new Date().getFullYear()): AgeGroup | null {
  if (!birthYear) return null;
  const age = year - birthYear;
  return age < 18 ? 'teen' : age < 25 ? 'young' : age < 40 ? 'adult' : age < 55 ? 'mature' : 'senior';
}

/** aka: бичлэгийн нэр, сувгаас таних нэрс. hard: уурласан, түгшсэн үед санал болгохгүй */
export type Artist = { name: string; aka?: string[]; genres: Genre[]; ages: AgeGroup[]; hard?: boolean };

export const MN_ARTISTS: Artist[] = [
  { name: 'Rokit Bay', aka: ['Рокит Бэй'], genres: ['Хип хоп, рэп'], ages: ['teen', 'young', 'adult'] },
  { name: 'Big Gee', aka: ['Gee'], genres: ['Хип хоп, рэп'], ages: ['teen', 'young', 'adult'] },
  { name: 'Desant', aka: ['Десант'], genres: ['Хип хоп, рэп'], ages: ['teen', 'young'] },
  { name: 'ThunderZ', genres: ['Хип хоп, рэп'], ages: ['teen', 'young'] },
  { name: "Young Mo'G", aka: ['Young Mo'], genres: ['Хип хоп, рэп'], ages: ['teen', 'young'] },
  { name: 'Мөнхийн Рэп', aka: ['Мөнхийн Реп', 'Munkhiin Rap'], genres: ['Хип хоп, рэп'], ages: ['young', 'adult'] },
  { name: 'MC Collection', genres: ['Хип хоп, рэп', 'Поп'], ages: ['young', 'adult'] },
  { name: 'Bodikhuu', aka: ['Бодьхүү'], genres: ['Поп', 'Хип хоп, рэп'], ages: ['teen', 'young'] },
  { name: 'Luuya', aka: ['Лүүяа'], genres: ['Поп'], ages: ['teen', 'young'] },
  { name: 'Баярцэнгэл', aka: ['Bayartsengel'], genres: ['Поп'], ages: ['teen', 'young', 'adult'] },
  { name: 'Ginjin', aka: ['Гинжин'], genres: ['Поп'], ages: ['young', 'adult'] },
  { name: 'Bohisharga', aka: ['Бохишарга'], genres: ['Поп', 'Ардын дуу'], ages: ['young', 'adult'] },
  { name: 'Naki', genres: ['R&B'], ages: ['young', 'adult'] },
  { name: 'Ankhmaa', aka: ['Анхмаа'], genres: ['R&B', 'Поп'], ages: ['young', 'adult'] },
  { name: 'BX', genres: ['R&B'], ages: ['adult', 'mature'] },
  { name: 'Magnolian', aka: ['Магнолиан'], genres: ['Инди'], ages: ['teen', 'young', 'adult'] },
  { name: 'NMN', genres: ['Инди'], ages: ['teen', 'young'] },
  { name: 'The Royal Heartaches', genres: ['Инди'], ages: ['young', 'adult'] },
  { name: 'Нисванис', aka: ['Nisvanis'], genres: ['Рок'], ages: ['young', 'adult'] },
  { name: 'Хурд', aka: ['Hurd'], genres: ['Рок'], ages: ['young', 'adult', 'mature', 'senior'] },
  { name: 'Харанга', aka: ['Haranga'], genres: ['Рок'], ages: ['adult', 'mature', 'senior'] },
  { name: 'Болд', aka: ['Bold'], genres: ['Поп'], ages: ['young', 'adult', 'mature'] },
  { name: 'Камертон', aka: ['Camerton'], genres: ['Поп'], ages: ['adult', 'mature'] },
  { name: 'Эрдэнэчимэг', aka: ['Erdenechimeg'], genres: ['Поп'], ages: ['adult', 'mature'] },
  { name: 'Алтан Ураг', aka: ['Altan Urag'], genres: ['Ардын дуу', 'Рок'], ages: ['young', 'adult', 'mature'] },
  { name: 'The HU', genres: ['Метал', 'Рок'], ages: ['teen', 'young', 'adult'], hard: true },
  { name: 'Батцэцэглэн', aka: ['Battsetseglen'], genres: ['Ардын дуу'], ages: ['adult', 'mature'] },
  { name: 'Түмэн-Өлзий Жимсээ', aka: ['Tumen-Ulzii', 'Tumenulzii', 'Түмэн-Өлзий'], genres: ['Ардын дуу'], ages: ['adult', 'mature'] },
  { name: 'С.Жавхлан', aka: ['Жавхлан', 'Javkhlan'], genres: ['Ардын дуу', 'Поп'], ages: ['adult', 'mature', 'senior'] },
  { name: 'Болортуяа', aka: ['Bolortuya'], genres: ['Поп', 'Ардын дуу'], ages: ['mature', 'senior'] },
  { name: 'Дуулим', aka: ['Duulim'], genres: ['Ардын дуу'], ages: ['mature', 'senior'] },
  { name: 'Энхзул', aka: ['Enkhzul'], genres: ['Ардын дуу'], ages: ['mature', 'senior'] },
  { name: 'Банзрагч', aka: ['Banzragch'], genres: ['Ардын дуу'], ages: ['mature', 'senior'] },
  { name: 'Л.Болдбаатар', aka: ['Болдбаатар', 'Boldbaatar'], genres: ['Ардын дуу', 'Поп'], ages: ['mature', 'senior'] },
  { name: 'Б.Энхтайван', aka: ['Энхтайван', 'Enkhtaivan'], genres: ['Ардын дуу'], ages: ['mature', 'senior'] },
  { name: 'Н.Норовбанзад', aka: ['Норовбанзад', 'Norovbanzad'], genres: ['Ардын дуу'], ages: ['mature', 'senior'] },
  { name: 'Баянмонгол', aka: ['Bayan Mongol'], genres: ['Жазз'], ages: ['mature', 'senior'] },
  { name: 'Solla & OzzoBand', aka: ['OzzoBand', 'Solla'], genres: ['Жазз'], ages: ['young', 'adult'] },
  { name: 'Морин хуурын чуулга', aka: ['Morin Khuur', 'Morinkhuur'], genres: ['Сонгодог хөгжим'], ages: ['adult', 'mature', 'senior'] },
];

export const INTL_ARTISTS: Artist[] = [
  { name: 'BTS', genres: ['K-pop'], ages: ['teen', 'young'] },
  { name: 'BLACKPINK', genres: ['K-pop'], ages: ['teen', 'young'] },
  { name: 'Stray Kids', genres: ['K-pop'], ages: ['teen'] },
  { name: 'Olivia Rodrigo', genres: ['Поп'], ages: ['teen', 'young'] },
  { name: 'Billie Eilish', genres: ['Поп', 'Инди'], ages: ['teen', 'young'] },
  { name: 'Taylor Swift', genres: ['Поп'], ages: ['teen', 'young', 'adult'] },
  { name: 'The Weeknd', genres: ['R&B', 'Поп'], ages: ['young', 'adult'] },
  { name: 'SZA', genres: ['R&B'], ages: ['young', 'adult'] },
  { name: 'Bruno Mars', genres: ['Поп', 'R&B'], ages: ['young', 'adult'] },
  { name: 'Dua Lipa', genres: ['Поп', 'Электрон'], ages: ['young', 'adult'] },
  { name: 'Drake', genres: ['Хип хоп, рэп'], ages: ['young', 'adult'] },
  { name: 'Kendrick Lamar', genres: ['Хип хоп, рэп'], ages: ['young', 'adult'] },
  { name: 'Eminem', genres: ['Хип хоп, рэп'], ages: ['young', 'adult', 'mature'] },
  { name: 'Avicii', genres: ['Электрон'], ages: ['young', 'adult'] },
  { name: 'Ed Sheeran', genres: ['Поп'], ages: ['young', 'adult', 'mature'] },
  { name: 'Adele', genres: ['Поп'], ages: ['young', 'adult', 'mature'] },
  { name: 'Coldplay', genres: ['Рок', 'Поп'], ages: ['young', 'adult', 'mature'] },
  { name: 'Imagine Dragons', genres: ['Рок'], ages: ['teen', 'young', 'adult'] },
  { name: 'Arctic Monkeys', genres: ['Инди', 'Рок'], ages: ['young', 'adult'] },
  { name: 'Linkin Park', genres: ['Рок'], ages: ['young', 'adult'] },
  { name: 'Metallica', genres: ['Метал', 'Рок'], ages: ['adult', 'mature'], hard: true },
  { name: 'Queen', genres: ['Рок'], ages: ['adult', 'mature', 'senior'] },
  { name: 'Michael Jackson', genres: ['Поп'], ages: ['adult', 'mature', 'senior'] },
  { name: 'Scorpions', genres: ['Рок'], ages: ['mature', 'senior'] },
  { name: 'Celine Dion', genres: ['Поп'], ages: ['mature', 'senior'] },
  { name: 'ABBA', genres: ['Поп'], ages: ['mature', 'senior'] },
  { name: 'The Beatles', genres: ['Рок'], ages: ['mature', 'senior'] },
  { name: 'Louis Armstrong', genres: ['Жазз'], ages: ['mature', 'senior'] },
  { name: 'Norah Jones', genres: ['Жазз'], ages: ['adult', 'mature'] },
  { name: 'Ludovico Einaudi', genres: ['Сонгодог хөгжим'], ages: ['young', 'adult', 'mature', 'senior'] },
];

/** Метал ба түүнтэй ижил хатуу хөгжимд тохирох mood. Бусад үед санал болгохгүй. */
const HARD_OK = new Set(['happy', 'neutral']);
export const hardAllowed = (mood: string) => HARD_OK.has(mood);

const byName = new Map([...MN_ARTISTS, ...INTL_ARTISTS].map(a => [a.name.toLowerCase(), a]));
export const findArtist = (name: string) => byName.get(name.trim().toLowerCase());

const fit = (a: Artist, age: AgeGroup | null, genres: Genre[]) =>
  (age && a.ages.includes(age) ? 2 : 0) + (a.genres.some(g => genres.includes(g)) ? 3 : 0);

/** Нас, төрөлд хамгийн ойрыг нь эхэнд. Юу ч таараагүй бол 0 оноотой ч жагсаалтад үлдэнэ. */
export function rankArtists(list: Artist[], age: AgeGroup | null, genres: Genre[], rand: () => number = () => 0.5) {
  return list.map(a => ({ a, k: fit(a, age, genres) + rand() })).sort((x, y) => y.k - x.k).map(x => x.a);
}

/** Анх орохдоо сонгох дуучдын сонголт */
export function artistOptions(age: AgeGroup | null, genres: Genre[], n = 14) {
  return { mongolian: rankArtists(MN_ARTISTS, age, genres).slice(0, n).map(a => a.name), international: rankArtists(INTL_ARTISTS, age, genres).slice(0, n).map(a => a.name) };
}

const AGE_EN: Record<AgeGroup, string> = { teen: '13-17', young: '18-24', adult: '25-39', mature: '40-54', senior: '55 or older' };
export const ageLabel = (g: AgeGroup) => AGE_EN[g];
