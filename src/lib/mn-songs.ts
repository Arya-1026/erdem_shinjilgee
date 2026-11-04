/* ---------- Дууны төрөл, монгол дуунууд ----------
   LLM монгол дууны нэрийг зохиож хэлдэг, YouTube-ийн "Music" ангилалд ч ихэнх нь ордоггүй тул
   шалгасан бодит бичлэгүүдийг гараар жагсаасан. video_id шууд мэдэгдэж байгаа тул хайлтын квот зарцуулахгүй.
   Mood, төрлийг дууны нэр, уран бүтээлчээр нь оноосон. Эхний FEATURED дуу нь апп-ын ерөнхий зөвлөмжид (RECS) орно. */
import type { MoodId, SongRec } from './types';

/** Хэрэглэгчийн сонгох дууны төрөл. profiles.hobbies дотор хадгалагдана. Утга нь LLM-д явуулах англи нэр. */
export const GENRE_EN = {
  'Поп': 'pop', 'Рок': 'rock', 'Хип хоп, рэп': 'hip-hop / rap', 'R&B': 'R&B', 'Ардын дуу': 'folk', 'Метал': 'metal',
  'Инди': 'indie', 'K-pop': 'K-pop', 'Электрон': 'electronic / EDM', 'Жазз': 'jazz', 'Сонгодог хөгжим': 'classical', 'Lo-fi': 'lo-fi',
} as const;
export type Genre = keyof typeof GENRE_EN;
export const SONG_GENRES = Object.keys(GENRE_EN) as Genre[];
export const pickGenres = (hobbies: string[]) => SONG_GENRES.filter(g => hobbies.includes(g));

// Монголд тусдаа төрөл болж хөгжөөгүй төрлүүдэд хамгийн ойрыг нь санал болгоно
const NEAREST: Partial<Record<Genre, Genre>> = { 'K-pop': 'Поп', 'Электрон': 'Поп', 'Lo-fi': 'Инди' };

export type MnSong = { id: string; title: string; artist: string; dur: number; moods: MoodId[]; genres: Genre[] };

export const MN_SONGS: MnSong[] = [
  { id: 'cGAT-y6Ffss', title: 'Сэтгэлийн хүч', artist: 'Камертон', dur: 315, moods: ['sad', 'anxious', 'tired'], genres: ['Поп'] },
  { id: 'v22ASLZ5o4M', title: 'Гарагийн өдөр', artist: 'Luuya', dur: 169, moods: ['happy', 'neutral'], genres: ['Поп'] },
  { id: '0RaWPPxvfl4', title: 'Өвөлжөө', artist: 'Magnolian', dur: 337, moods: ['calm', 'tired'], genres: ['Инди'] },
  { id: 'v4xZUr0BEfE', title: 'Yuve Yuve Yu', artist: 'The HU', dur: 353, moods: ['angry', 'happy'], genres: ['Метал', 'Рок'] },
  { id: 'PiRNggf0Lu4', title: 'Нулимсаа тэвчье', artist: 'Хурд', dur: 348, moods: ['sad'], genres: ['Рок'] },
  { id: 'y-p21fbzsyk', title: 'Хязгааргүй', artist: 'Rokit Bay ft. Anouca', dur: 212, moods: ['happy', 'neutral'], genres: ['Хип хоп, рэп'] },
  { id: 'Y7nfl9UtGuA', title: 'Амар мэндийн дуу', artist: 'Хурд', dur: 332, moods: ['neutral', 'calm', 'happy'], genres: ['Рок'] },
  { id: 'YdQ_Ml8BdgU', title: 'Эргэцүүлэл', artist: 'Big Gee ft. Medegma Dorjieva', dur: 246, moods: ['calm', 'sad', 'tired', 'anxious'], genres: ['Хип хоп, рэп'] },
  { id: 'cNyv-tc-aAY', title: 'Үлэмжийн чанар', artist: 'Н.Норовбанзад', dur: 204, moods: ['calm', 'anxious', 'tired'], genres: ['Ардын дуу'] },
  { id: '7kUBpqg4_ZI', title: 'Муу зуршил', artist: 'Нисванис', dur: 287, moods: ['angry', 'neutral'], genres: ['Рок'] },
  { id: 'ct80jYWsDlA', title: 'Зүрхний тал', artist: 'Naki ft. Hishigdalai', dur: 307, moods: ['sad', 'calm'], genres: ['R&B'] },
  { id: 'KMaMJtVJFLU', title: 'Waiting For You', artist: 'Ankhmaa', dur: 251, moods: ['calm', 'tired', 'anxious'], genres: ['R&B'] },
  { id: 'Y50svVQ5cEk', title: 'Агшин 2', artist: 'Solla & OzzoBand', dur: 152, moods: ['happy', 'calm', 'neutral'], genres: ['Жазз'] },
  { id: 'Cru4ClW-ELE', title: 'Цагаан суварга', artist: 'Н.Жанцанноров', dur: 219, moods: ['calm', 'sad', 'anxious'], genres: ['Сонгодог хөгжим'] },
  { id: 'KmtM7jIrEDs', title: 'Хоёр сэтгэл', artist: 'Батцэцэглэн', dur: 209, moods: ['calm', 'sad'], genres: ['Ардын дуу'] },
  { id: 'YDPj3MMPWFQ', title: 'Аадар', artist: 'Rokit Bay', dur: 221, moods: ['angry', 'sad'], genres: ['Хип хоп, рэп'] },
  { id: 'NinVDQlmTp0', title: 'Woods', artist: 'Magnolian', dur: 214, moods: ['anxious', 'calm'], genres: ['Инди'] },
  { id: 'jM8dCGIm6yc', title: 'Wolf Totem', artist: 'The HU', dur: 397, moods: ['angry'], genres: ['Метал', 'Рок'] },

  // Поп
  { id: 'vCm-w0AQpCA', title: 'Тайван', artist: 'Ratabuzz', dur: 175, moods: ['anxious', 'calm'], genres: ['Поп', 'Хип хоп, рэп'] },
  { id: '_Z3mHnzTJMo', title: 'Chigi Tigi Boom', artist: 'Bayartsengel & Anu', dur: 206, moods: ['happy'], genres: ['Поп'] },
  { id: 'S9T1NSo1OVU', title: 'Асах гэрэл', artist: 'Камертон', dur: 286, moods: ['anxious', 'neutral'], genres: ['Поп'] },
  { id: '3-2Y3ijsOx4', title: 'Хайрын хот', artist: 'Камертон', dur: 249, moods: ['calm', 'happy'], genres: ['Поп'] },
  { id: 'Ud7iRe6kuE0', title: 'Гэгээн домог', artist: 'Болд', dur: 282, moods: ['neutral', 'calm'], genres: ['Поп'] },
  { id: 'jQRhhhTPX7A', title: 'Яаж чи өөрчлөгдөв', artist: 'Болд', dur: 254, moods: ['sad'], genres: ['Поп'] },
  { id: 'wbLotUeXSP0', title: 'Чи надад дурлаасай', artist: 'Болд', dur: 218, moods: ['happy', 'calm'], genres: ['Поп'] },
  { id: '23HjASzVHGQ', title: 'Борооны үнэр', artist: 'Баярцэнгэл', dur: 221, moods: ['sad', 'tired'], genres: ['Поп'] },
  { id: 'CtNj58UrnZE', title: 'Хайр эзэнтэй', artist: 'Баярцэнгэл', dur: 200, moods: ['calm', 'sad'], genres: ['Поп'] },
  { id: 'HP28rLnAbXE', title: 'Tonjoo', artist: 'Bayanjargal ft Luuya', dur: 177, moods: ['happy', 'neutral'], genres: ['Поп'] },

  // Рок
  { id: 'U8aua1UqijI', title: 'Амьдрал', artist: 'Харанга', dur: 551, moods: ['tired', 'sad', 'neutral'], genres: ['Рок'] },
  { id: 'RHK0sHv-LsE', title: 'Нэргүй дуу', artist: 'Нисванис', dur: 329, moods: ['sad', 'calm'], genres: ['Рок'] },
  { id: 'ChFnLzmpUoc', title: 'Бороо', artist: 'Харанга', dur: 248, moods: ['sad', 'calm'], genres: ['Рок'] },
  { id: 'Ak8LluYGDoY', title: 'Үгүйлэн санана', artist: 'Харанга', dur: 351, moods: ['sad'], genres: ['Рок'] },
  { id: 'gCOfB02ZRsk', title: 'Толин хул', artist: 'Харанга & Татар', dur: 294, moods: ['angry'], genres: ['Рок', 'Хип хоп, рэп'] },
  { id: 'tWTAIasP4rk', title: 'Эсрэг утгаар нь', artist: 'Нисванис', dur: 243, moods: ['angry', 'neutral'], genres: ['Рок'] },
  { id: '6_KtTfifqsY', title: 'Бүсгүй', artist: 'Хурд', dur: 295, moods: ['calm', 'neutral'], genres: ['Рок'] },
  { id: 'L50uM-otc90', title: 'Аавдаа', artist: 'Хурд', dur: 352, moods: ['sad', 'tired'], genres: ['Рок'] },
  { id: 'XTacCEDgeYY', title: 'Халуун сэтгэл', artist: 'Харанга', dur: 323, moods: ['happy', 'calm'], genres: ['Рок'] },
  { id: 'VtNIUPHqPoA', title: 'Аялгуу', artist: 'Харанга', dur: 339, moods: ['calm', 'anxious'], genres: ['Рок'] },

  // Хип хоп, рэп
  { id: 'ygf3y67sn8c', title: 'Нэг өдрийн хаан', artist: 'Rokit Bay', dur: 301, moods: ['neutral', 'tired'], genres: ['Хип хоп, рэп'] },
  { id: 'aQfa1XlGcBI', title: 'Эвдэрхий хүн', artist: 'Rokit Bay ft. Uyanga', dur: 298, moods: ['sad', 'anxious'], genres: ['Хип хоп, рэп'] },
  { id: '-0hM8q-yxz8', title: 'Яасан', artist: 'Big Gee', dur: 273, moods: ['angry', 'sad'], genres: ['Хип хоп, рэп'] },
  { id: 'khIrGY6rWiI', title: 'Power', artist: 'Desant x Big Gee', dur: 149, moods: ['angry', 'happy'], genres: ['Хип хоп, рэп'] },
  { id: 'QpF77ks6UgY', title: 'Одоо ч би хайртай хэвээр', artist: 'Big Gee ft. Nyamkhuu', dur: 189, moods: ['sad', 'calm'], genres: ['Хип хоп, рэп'] },
  { id: 'xlD1dhAToac', title: 'Зөөлөн гуниг', artist: 'Мөнхийн Рэп', dur: 268, moods: ['sad', 'tired'], genres: ['Хип хоп, рэп'] },
  { id: 'VkajLZ-JdK8', title: 'Tengri: Mongol', artist: 'ThunderZ', dur: 267, moods: ['happy', 'angry'], genres: ['Хип хоп, рэп'] },

  // R&B
  { id: '9fn83iJ6ni8', title: 'One Love (Ийм нэгэн дурлал)', artist: 'BX', dur: 288, moods: ['happy', 'calm'], genres: ['R&B'] },
  { id: 'XfnovPZ-o9Q', title: '100 хувь', artist: 'Egshiglen & BX', dur: 194, moods: ['happy', 'neutral'], genres: ['R&B'] },

  // Ардын дуу
  { id: 'e2VgPucnLSo', title: 'Нутгийн айзам', artist: 'Түмэн-Өлзий Жимсээ', dur: 185, moods: ['calm', 'tired'], genres: ['Ардын дуу'] },
  { id: 'zP-MnSkCdYQ', title: 'Хөх толботон', artist: 'Алтан Ураг', dur: 222, moods: ['anxious', 'angry'], genres: ['Ардын дуу', 'Рок'] },
  { id: 'FNHqSrcj5Ks', title: 'Сайн яваа хүний хань', artist: 'Энхзул', dur: 231, moods: ['calm', 'tired', 'anxious'], genres: ['Ардын дуу'] },
  { id: 'L2MAyVLbaMs', title: 'Хүмүүний сайхан хайрыг', artist: 'Банзрагч', dur: 265, moods: ['calm', 'neutral'], genres: ['Ардын дуу'] },
  { id: 'hxRUwILrB7E', title: 'Хотгойдын унага', artist: 'Монгол ардын дуу', dur: 114, moods: ['happy', 'neutral'], genres: ['Ардын дуу'] },
  { id: '-lvtJ4yLyJo', title: 'Дөрвөн цагийн тал', artist: 'Н.Норовбанзад', dur: 184, moods: ['calm', 'tired'], genres: ['Ардын дуу'] },
  { id: 'HXHdqRKHGJU', title: 'Уяхан замбуу тивийн наран', artist: 'Н.Норовбанзад', dur: 317, moods: ['calm', 'anxious', 'sad'], genres: ['Ардын дуу'] },
  { id: 'CjohhxJVUMQ', title: 'Оньсого', artist: 'Алтан Ураг', dur: 155, moods: ['happy', 'neutral'], genres: ['Ардын дуу'] },

  // Метал
  { id: '4Y2gK4n35hw', title: 'This Is Mongol', artist: 'The HU', dur: 278, moods: ['happy', 'angry'], genres: ['Метал', 'Рок'] },
  { id: 'Ef9NK-RaNZE', title: 'Echoes of My Father', artist: 'The HU', dur: 381, moods: ['sad', 'tired'], genres: ['Метал', 'Рок'] },
  { id: 'pD1gDSao1eA', title: 'The Great Chinggis Khaan', artist: 'The HU', dur: 307, moods: ['neutral', 'happy'], genres: ['Метал', 'Рок'] },
  { id: 'GqrKj5lD5y4', title: 'Warrior Chant', artist: 'The HU', dur: 236, moods: ['angry'], genres: ['Метал'] },

  // Инди
  { id: 'L1U-FOngLog', title: 'Caroline', artist: 'Magnolian', dur: 285, moods: ['neutral', 'calm'], genres: ['Инди'] },
  { id: 'aWJ6JxbFMug', title: 'Primadonna', artist: 'Magnolian', dur: 256, moods: ['happy'], genres: ['Инди'] },
  { id: 'QblesJCcw8s', title: 'The Bride & the Bachelor', artist: 'Magnolian ft. Tselmuun', dur: 271, moods: ['sad', 'tired'], genres: ['Инди'] },
  { id: 'J5Pr9-VW68o', title: 'Crimson', artist: 'Magnolian', dur: 188, moods: ['anxious', 'angry'], genres: ['Инди'] },
  { id: 'epcUYrseeJE', title: 'Навчны дуу', artist: 'The Royal Heartaches', dur: 233, moods: ['calm', 'neutral'], genres: ['Инди'] },

  // Жазз
  { id: 'jgpDXmWT0Fc', title: 'Аяны шувууд', artist: 'Баянмонгол', dur: 200, moods: ['calm', 'neutral', 'sad'], genres: ['Жазз'] },
  { id: '7pnsd1OgdDI', title: 'Хүнгийн дуу (Jazz cover)', artist: 'Nandintsetseg', dur: 177, moods: ['calm', 'sad', 'tired'], genres: ['Жазз'] },

  // Сонгодог: морин хуурын чуулга
  { id: '4Hbp__4awXw', title: 'Сэрсэн тал', artist: 'Б.Шарав, Морин хуурын чуулга', dur: 196, moods: ['calm', 'neutral', 'tired'], genres: ['Сонгодог хөгжим'] },
  { id: 'NpWmZ9zLx2o', title: 'Торгоны хээ', artist: 'Морин хуурын чуулга', dur: 223, moods: ['calm', 'anxious', 'happy'], genres: ['Сонгодог хөгжим'] },
  { id: 'Ykz6ZokoEoQ', title: 'Огторгуйн хүрдэн', artist: 'Морин хуурын чуулга', dur: 681, moods: ['tired', 'neutral'], genres: ['Сонгодог хөгжим'] },
];

export const FEATURED = 18;
export const MN_IDS = new Set(MN_SONGS.map(s => s.id));
export const ytThumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

const WHY: Record<MoodId, string> = {
  happy: 'Сайхан өдрийн эрч хүчийг нэмэх монгол дуу', calm: 'Тайван мөчид зохих монгол дуу', neutral: 'Өдрөө дулаацуулах монгол дуу',
  tired: 'Ядарсан үед дулаахан сонсогдох монгол дуу', anxious: 'Сэтгэлийг амраах монгол дуу', sad: 'Сэтгэлд ойр монгол дуу', angry: 'Уураа хүч болгон гаргах монгол дуу',
};

/**
 * Тухайн mood, төрөлд тохирох монгол дуунууд. Эрэмбэ: төрөл + mood → зөвхөн төрөл → зөвхөн mood.
 * skip: хасах (👎, өөрийн сан), seen: сүүлд гарсан тул тухайн бүлгийнхээ төгсгөлд тавих.
 */
export function pickMongolian(mood: MoodId, skip: Set<string>, seen: Set<string>, n: number, genres: Genre[] = [], rand = Math.random): SongRec[] {
  const wanted = new Set(genres.map(g => NEAREST[g] ?? g));
  return MN_SONGS.flatMap(s => {
    const fits = s.moods.includes(mood), genre = s.genres.find(g => wanted.has(g));
    if (skip.has(s.id) || (!fits && !genre)) return [];
    const tier = genre ? (fits ? 0 : 1) : 2;
    return [{ s, genre, k: tier * 2 + (seen.has(s.id) ? 1 : 0) + rand() }];
  }).sort((a, b) => a.k - b.k).slice(0, n)
    .map(({ s, genre }) => ({ video_id: s.id, title: s.title, artist: s.artist, thumbnail: ytThumb(s.id), duration_s: s.dur, reason: genre ? `Таны сонгосон төрөл: ${genre}` : WHY[mood] }));
}

/** Хоёр жагсаалтыг ээлжлэн холино: a[0], b[0], a[1], b[1]… */
export function interleave<T>(a: T[], b: T[]) {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) { if (i < a.length) out.push(a[i]); if (i < b.length) out.push(b[i]); }
  return out;
}
