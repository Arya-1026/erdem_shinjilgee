/* ---------- Кино: IMDb-ийн үнэлгээтэй каталогоос хүн бүрт тохирохыг сонгох ----------
   Каталог: public/movies.json (`npm run movies`, IMDb 7.2+ үнэлгээтэй, 80,000+ хүн үнэлсэн кинонууд).
   Оноо = IMDb чанар + тухайн mood-д тохирох төрөл + хобби + нас + 👍/👎-ын түүх. Цэвэр функц тул тестлэгдэнэ. */
import type { MoodId, ScoredRec } from './types';

export type Movie = {
  id: string; t: string; y: number; r: number; v: number; m: number; g: string[];
  /** эх хэл (ISO 639-1) */ l: string[];
  /** монгол нэр (Wikidata) */ mn?: string;
  /** постер: upload.wikimedia.org/wikipedia/ дараах зам */ p?: string;
  /** товч агуулга (англи Wikipedia) */ d?: string;
};

export const GENRE_MN: Record<string, string> = {
  Action: 'Тулаант', Adventure: 'Адал явдалт', Animation: 'Хүүхэлдэйн', Biography: 'Намтар', Comedy: 'Инээдмийн', Crime: 'Гэмт хэрэг',
  Documentary: 'Баримтат', Drama: 'Драм', Family: 'Гэр бүлийн', Fantasy: 'Уран зөгнөлт', 'Film-Noir': 'Нуар', History: 'Түүхэн', Horror: 'Аймшгийн',
  Music: 'Хөгжимт', Musical: 'Мюзикл', Mystery: 'Нууцлаг', Romance: 'Хайр дурлалын', 'Sci-Fi': 'Шинжлэх ухааны уран зөгнөлт', Sport: 'Спорт',
  Thriller: 'Триллер', War: 'Дайны', Western: 'Вестерн',
};

// Тухайн mood-той хүнд аль төрөл тусалдаг, алийг нь зайлсхийх вэ.
// Түгшсэн, гунигтай, уурласан, ядарсан үед айдас, хүчирхийлэл ихтэй төрлийг санал болгохгүй.
const MOOD_GENRES: Record<MoodId, Record<string, number>> = {
  happy: { Adventure: 2, Comedy: 1.5, Action: 1, 'Sci-Fi': 1, Fantasy: 1, Musical: 1, Animation: 1 },
  calm: { Drama: 1, Romance: 1, Animation: 1.5, Biography: 1, Documentary: 1, Music: 1, Family: 1, Horror: -3, War: -1 },
  neutral: { Adventure: 1.5, Comedy: 1, 'Sci-Fi': 1, Mystery: 1, Drama: 0.5, Animation: 1 },
  tired: { Animation: 2, Comedy: 2, Family: 1.5, Romance: 1, Fantasy: 1, War: -3, Horror: -5, Thriller: -2, Crime: -1 },
  anxious: { Action: -1, Animation: 2.5, Family: 2, Comedy: 2, Adventure: 1, Fantasy: 1, Music: 1, Horror: -6, Thriller: -5, War: -4, Crime: -3, Mystery: -2 },
  sad: { Action: -0.5, Comedy: 2.5, Animation: 2, Family: 2, Music: 1, Romance: 1, Adventure: 1, Horror: -5, War: -4, Crime: -2, Thriller: -2 },
  angry: { Comedy: 2.5, Sport: 2, Adventure: 1, Animation: 1.5, Music: 1, Family: 1, Horror: -4, War: -3, Crime: -3, Thriller: -3 },
};
const WHY_MOOD: Record<MoodId, string> = {
  happy: 'Сайхан сэтгэлээ улам сэргээх', calm: 'Тайван үед аажуу таашаах', neutral: 'Энгийн өдрийг сонирхолтой болгох',
  tired: 'Ядарсан үед хөнгөн, дулаахан', anxious: 'Түгшсэн үед аюулгүй, тайвшруулах', sad: 'Гунигтай үед сэтгэл сэргээх', angry: 'Уураа гаргаж, инээлгэх',
};

// Хобби → кинонд илүү оноо өгөх төрөл, хэл
const HOBBY_FIT: Record<string, { g?: string[]; l?: string[] }> = {
  'Анимэ': { g: ['Animation'], l: ['ja'] }, 'K-драма': { l: ['ko'] }, 'Баримтат кино': { g: ['Documentary'] }, 'Инээдмийн шоу': { g: ['Comedy'] },
  'Аймшгийн кино': { g: ['Horror', 'Thriller'] }, 'Түүх': { g: ['History', 'Biography', 'War'] }, 'Шинжлэх ухаан': { g: ['Sci-Fi', 'Documentary'] },
  'Хиймэл оюун': { g: ['Sci-Fi'] }, 'Програмчлал': { g: ['Sci-Fi'] }, 'Робот': { g: ['Sci-Fi'] }, 'Тоглоом': { g: ['Sci-Fi', 'Fantasy', 'Action'] },
  'Уран зохиол': { g: ['Drama'] }, 'Шүлэг': { g: ['Drama', 'Romance'] }, 'Сэтгэл судлал': { g: ['Drama', 'Mystery'] }, 'Театр': { g: ['Drama', 'Musical'] },
  'Дуу сонсох': { g: ['Music'] }, 'Хөгжим тоглох': { g: ['Music'] }, 'Дуулах': { g: ['Music', 'Musical'] }, 'Гитар': { g: ['Music'] }, 'Хөгжим зохиох': { g: ['Music'] },
  'Бүжиг': { g: ['Musical', 'Music'] }, 'Аялал': { g: ['Adventure'] }, 'Явган аялал': { g: ['Adventure'] }, 'Майхан': { g: ['Adventure'] }, 'Од ажиглах': { g: ['Sci-Fi'] },
  'Нохой': { g: ['Family'] }, 'Муур': { g: ['Family'] }, 'Гэр бүлтэйгээ': { g: ['Family'] }, 'Гэрэл зураг': { g: ['Biography', 'Adventure'] }, 'Зураг': { g: ['Animation', 'Biography'] },
  'Фитнесс': { g: ['Sport'] }, 'Гүйлт': { g: ['Sport'] }, 'Сагсан бөмбөг': { g: ['Sport'] }, 'Хөл бөмбөг': { g: ['Sport'] }, 'Бокс': { g: ['Sport'] }, 'Бөх, жүдо': { g: ['Sport', 'Action'] },
  'Шатар': { g: ['Biography', 'Drama'] }, 'Хоол хийх': { g: ['Comedy', 'Family'] },
};
const SCARY = new Set(['Horror', 'Thriller', 'War']);

export type Taste = { mood: MoodId; hobbies: string[]; birthYear: number | null; feedback: Record<string, number>; watchlist?: string[]; seed?: string };

/** Өдөр бүр өөрчлөгдөх, гэхдээ тухайн өдөр тогтвортой санамсаргүй тоо */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
}

const posterUrl = (p?: string) => (p ? `https://upload.wikimedia.org/wikipedia/${p}` : undefined);
export const movieTitle = (x: Movie) => `${x.mn ?? x.t} (${x.y})`;

export function scoreMovie(x: Movie, t: Taste, liked: Record<string, number>) {
  const mood = MOOD_GENRES[t.mood];
  const scary = x.g.some(g => SCARY.has(g));
  const quality = (x.r - 7.2) * 2.2 + Math.log10(x.v / 80_000) * 1.2;
  const moodFit = x.g.reduce((s, g) => s + (mood[g] ?? 0), 0);
  const hobbyGenres = t.hobbies.flatMap(h => HOBBY_FIT[h]?.g ?? []), hobbyLangs = t.hobbies.flatMap(h => HOBBY_FIT[h]?.l ?? []);
  // Аймшгийн киног зөвхөн дуртай нь, бас сэтгэл санаа сайн үед
  const hobbyHit = x.g.filter(g => hobbyGenres.includes(g) && (!SCARY.has(g) || ['happy', 'neutral', 'calm'].includes(t.mood))).length + (x.l.some(l => hobbyLangs.includes(l)) ? 2 : 0);
  const taste = x.g.reduce((s, g) => s + (liked[g] ?? 0), 0);
  const age = t.birthYear && x.y >= t.birthYear + 10 && x.y <= t.birthYear + 30 ? 0.8 : 0;
  const long = ['tired', 'anxious'].includes(t.mood) && x.m > 150 ? -1.5 : 0;
  return { score: quality + moodFit + hobbyHit * 1.6 + taste + age + long + hash(x.id + (t.seed ?? '')) * 1.5, hobby: hobbyHit > 0, scary };
}

/** 👍/👎 дарсан кинонуудын төрлөөс амтыг тооцно */
function genreAffinity(catalog: Movie[], feedback: Record<string, number>) {
  const out: Record<string, number> = {};
  for (const x of catalog) {
    const v = feedback[x.id];
    if (v === 1 || v === -1) for (const g of x.g) out[g] = (out[g] ?? 0) + v * 1.2;
  }
  for (const g in out) out[g] = Math.max(-3, Math.min(3, out[g]));
  return out;
}

function reason(x: Movie, t: Taste, hobby: boolean) {
  const genres = x.g.map(g => GENRE_MN[g] ?? g).slice(0, 2).join(', ').toLowerCase();
  const bits = [`IMDb ${x.r.toFixed(1)}, ${Math.round(x.v / 1000).toLocaleString('en-US')} мянган хүн үнэлсэн`, `${WHY_MOOD[t.mood]} ${genres} кино`];
  if (hobby) bits.push('таны сонирхолд тохирсон');
  return bits.join('. ') + '.';
}

/** Хамгийн тохирох n кино. Нэг төрлөөс хэт олон гаргахгүй, 👎 дарсан, сэтгэл санаанд аюултайг хасна. */
export function recommendMovies(catalog: Movie[], t: Taste, n = 12): ScoredRec[] {
  const liked = genreAffinity(catalog, t.feedback);
  const minor = Boolean(t.birthYear && new Date().getFullYear() - t.birthYear < 18);
  const ranked = catalog.flatMap(x => {
    if (t.feedback[x.id] === -1) return [];
    const s = scoreMovie(x, t, liked);
    if (s.scary && !['happy', 'neutral', 'calm'].includes(t.mood)) return [];
    // 18-аас доош насныханд аймшгийн кино санал болгохгүй
    if (minor && x.g.includes('Horror')) return [];
    return [{ x, ...s }];
  }).sort((a, b) => b.score - a.score);

  const perGenre: Record<string, number> = {}, picked: typeof ranked = [];
  for (const c of ranked) {
    if (picked.length >= n) break;
    const main = c.x.g[0];
    if ((perGenre[main] ?? 0) >= Math.ceil(n / 3)) continue;
    perGenre[main] = (perGenre[main] ?? 0) + 1;
    picked.push(c);
  }
  return picked.map(({ x, score, hobby }) => ({
    id: x.id, type: 'movie', title: movieTitle(x), sub: `⭐ ${x.r.toFixed(1)} IMDb · ${x.g.map(g => GENRE_MN[g] ?? g).join(', ')}`,
    moods: [t.mood], poster: posterUrl(x.p), desc: x.d, why: reason(x, t, hobby), imdb: `https://www.imdb.com/title/${x.id}/`,
    hob: hobby, fb: t.feedback[x.id] ?? 0, score,
  }));
}
