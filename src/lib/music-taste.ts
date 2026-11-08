/* ---------- Хэрэглэгчийн хобби, сонгосон төрлөөс дууны төрөл гаргах ----------
   Сонгосон төрөл хамгийн хүчтэй дохио. Бусад хобби нь эндхийн холбоосоор төрөл болж, дараа нь эрэмбэлэгдэнэ.
   Хэрэглэгчийн өөрөө нэмсэн хобби төрөлгүй: AI-д текстээр л очно. */
import { GENRE_CAT, HOBBIES, LEGACY_HOBBIES } from './data';
import { mnGenre, pickGenres, type Genre } from './mn-songs';

/** Spotify-ийн `genre:` шүүлтүүрийн утга */
export const GENRE_QUERY: Record<Genre, string> = {
  'Поп': 'pop', 'Рок': 'rock', 'Хип хоп, рэп': 'hip hop', 'R&B': 'r&b', 'Ардын дуу': 'folk', 'Метал': 'metal',
  'Инди': 'indie', 'K-pop': 'k-pop', 'Электрон': 'edm', 'Жазз': 'jazz', 'Сонгодог хөгжим': 'classical', 'Lo-fi': 'lo-fi',
};

/** Ангиллын ерөнхий холбоос. Эхний төрөл хамгийн их жинтэй. */
export const CATEGORY_GENRES: Record<string, Genre[]> = {
  'Спорт': ['Хип хоп, рэп', 'Поп', 'Электрон'],
  'Бясалгал, эрүүл мэнд': ['Lo-fi', 'Сонгодог хөгжим'],
  'Урлаг': ['Инди', 'Жазз'],
  'Хөгжим': ['Поп', 'Инди'],
  'Уншлага, суралцах': ['Lo-fi', 'Сонгодог хөгжим'],
  'Кино, цуврал': ['Поп', 'Инди'],
  'Байгаль, аялал': ['Инди', 'Ардын дуу'],
  'Технологи, тоглоом': ['Lo-fi', 'Электрон'],
  'Хоол': ['Жазз', 'R&B'],
  'Гар урлал': ['Ардын дуу', 'Инди'],
  'Амьтан': ['Поп', 'Инди'],
  'Нийгэм, харилцаа': ['Поп', 'Хип хоп, рэп'],
  'Загвар, гоо сайхан': ['Поп', 'K-pop', 'R&B'],
};

/** Ангиллаасаа ялгаатай хоббинууд */
const HOBBY_GENRES: Record<string, Genre[]> = {
  'Гүйлт': ['Электрон', 'Хип хоп, рэп', 'Поп'],
  'Фитнесс': ['Электрон', 'Хип хоп, рэп', 'Рок'],
  'Цанаар гулгах': ['Рок', 'Электрон'],
  'Йог': ['Lo-fi', 'Сонгодог хөгжим'],
  'Бүжиг': ['K-pop', 'Поп', 'Электрон'],
  'Монгол бичиг': ['Ардын дуу', 'Сонгодог хөгжим'],
  'Гитар': ['Рок', 'Инди'],
  'Төгөлдөр хуур': ['Сонгодог хөгжим', 'Жазз'],
  'Морин хуур': ['Ардын дуу', 'Сонгодог хөгжим'],
  'K-драма': ['K-pop', 'R&B'],
  'Морь унах': ['Ардын дуу', 'Рок'],
  'Морь': ['Ардын дуу', 'Рок'],
  'Шагай': ['Ардын дуу'],
  'Тоглоом': ['Электрон', 'Рок'],
  'Тулаант тоглоом': ['Рок', 'Электрон'], 'Буудлагын тоглоом': ['Рок', 'Электрон'], 'Уралдааны тоглоом': ['Электрон', 'Хип хоп, рэп'],
  'Стратеги тоглоом': ['Сонгодог хөгжим', 'Lo-fi'], 'RPG тоглоом': ['Сонгодог хөгжим', 'Электрон'], 'Оньсого тоглоом': ['Lo-fi'],
  'Романтик кино': ['R&B', 'Поп'], 'Тулаант кино': ['Рок', 'Хип хоп, рэп'],
};

const CATEGORY_OF = new Map([...Object.entries(HOBBIES).filter(([c]) => c !== GENRE_CAT).flatMap(([c, items]) => items.map(h => [h, c] as const)), ...Object.entries(LEGACY_HOBBIES)]);
const genresOf = (hobby: string) => HOBBY_GENRES[hobby] ?? CATEGORY_GENRES[CATEGORY_OF.get(hobby) ?? ''] ?? [];

/** hobby: энэ төрлийг гаргасан хобби. Байхгүй бол хэрэглэгч төрлийг өөрөө сонгосон. */
export type TasteGenre = { genre: Genre; hobby?: string };

const HOBBY_GENRE_MAX = 3;

/** Эхэнд сонгосон төрлүүд, дараа нь хоббиос гарсан төрлүүд (олон хоббид давтагдсан нь түрүүнд) */
export function tasteGenres(hobbies: string[]): TasteGenre[] {
  const chosen = pickGenres(hobbies);
  const votes = new Map<Genre, { score: number; hobby: string }>();
  for (const hobby of hobbies) {
    genresOf(hobby).forEach((genre, i, list) => {
      if (chosen.includes(genre)) return;
      const v = votes.get(genre) ?? { score: 0, hobby };
      votes.set(genre, { ...v, score: v.score + list.length - i });
    });
  }
  const derived = [...votes].sort((a, b) => b[1].score - a[1].score).slice(0, HOBBY_GENRE_MAX).map(([genre, v]) => ({ genre, hobby: v.hobby }));
  return [...chosen.map(genre => ({ genre })), ...derived];
}

/** Дууны төрөлд таарах хэрэглэгчийн амт. K-pop зэрэг монголд ховор төрлийг ойролцоо төрлөөр нь тооцно. */
export const tasteMatch = (genres: readonly Genre[], taste: TasteGenre[]) =>
  taste.find(t => genres.includes(t.genre) || genres.includes(mnGenre(t.genre)));

/** Эрэмбэ: 0 дуртай дуучин, 1 сонгосон төрөл, 2 хоббиос гарсан төрөл, 3 бусад */
export const tasteRank = (t: TasteGenre | undefined) => (!t ? 3 : t.hobby ? 2 : 1);

export const tasteReason = (t: TasteGenre | undefined) =>
  !t ? '' : t.hobby ? `«${t.hobby}» хоббид тань` : `Таны сонгосон төрөл: ${t.genre}`;
