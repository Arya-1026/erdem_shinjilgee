/* ---------- Дууны төрөл, монгол дуунууд ----------
   LLM монгол дууны нэрийг зохиож хэлдэг тул Spotify дээр олдсон бодит дуунуудыг гараар жагсаасан.
   Mood-ийг судалгаанд тулгуурлан оноосон: уурласан, түгшсэн үед хатуу метал биш дунд/удаан хэмнэлтэй дуу (README → Дуу сонгох зарчим).
   Энэ жагсаалт шууд харагддаггүй: AI эндээс болон Spotify-аас олсон дуунуудаас сонгоно (server/music-recs.ts). */
import { hardAllowed } from './artists';
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

/** Монгол дуу хайхад ашиглах төрөл */
export const mnGenre = (g: Genre) => NEAREST[g] ?? g;

/** id: Spotify track id, img: цомгийн зургийн код (i.scdn.co/image/...) */
export type MnSong = { id: string; title: string; artist: string; dur: number; img: string; moods: MoodId[]; genres: Genre[] };

export const MN_SONGS: MnSong[] = [
  { id: '3kZ6bCM4JaTGApkchBTrCP', title: 'Өвөлжөө', artist: 'Magnolian', dur: 337, img: 'ab67616d00004851387b927cbb11c51b3ceb3a91', moods: ['calm', 'tired'], genres: ['Инди'] },
  { id: '3yBr5dRJAbjppfxZg3OUWZ', title: 'Yuve Yuve Yu', artist: 'The HU', dur: 283, img: 'ab67616d00004851a849f2dea216228f9039f3e9', moods: ['happy'], genres: ['Метал', 'Рок'] },
  { id: '6TPwgMWXtXuDlymEWgOs0f', title: 'Нулимсаа тэвчье', artist: 'Хурд', dur: 318, img: 'ab67616d000048512e83eb99a97036621ab8594f', moods: ['sad'], genres: ['Рок'] },
  { id: '3GiPe0NGHg44qc7nVSk4kp', title: 'Хязгааргүй', artist: 'Rokit Bay ft. Anouca', dur: 209, img: 'ab67616d0000485154053a683bc2751e29a6b898', moods: ['happy', 'neutral'], genres: ['Хип хоп, рэп'] },
  { id: '4EoW6PX4QYli2E4UbVJM9c', title: 'Амар мэндийн дуу', artist: 'Хурд', dur: 329, img: 'ab67616d000048518fcf82b713652ea067c624fc', moods: ['neutral', 'calm', 'happy', 'angry'], genres: ['Рок'] },
  { id: '76JrIAnBqqRfuU0LUx1xu5', title: 'Эргэцүүлэл', artist: 'Big Gee ft. Medegma Dorjieva', dur: 246, img: 'ab67616d00004851a895c162bbbee72c86269bcc', moods: ['calm', 'sad', 'tired', 'anxious', 'angry'], genres: ['Хип хоп, рэп'] },
  { id: '4dISgFpr0E9uqGbI6Dgzyv', title: 'Муу зуршил', artist: 'Нисванис', dur: 275, img: 'ab67616d000048513f12d84dae365797d0fe3496', moods: ['neutral'], genres: ['Рок'] },
  { id: '3wMxiDt4s1rhS6GtH6ll9b', title: 'Аадар', artist: 'Rokit Bay', dur: 215, img: 'ab67616d0000485192ea16635496e782facecf01', moods: ['sad'], genres: ['Хип хоп, рэп'] },
  { id: '0aOgNpAeUV4SlVLmJimK6p', title: 'Woods', artist: 'Magnolian', dur: 211, img: 'ab67616d00004851a5b2d8bf659fc9149897b3c2', moods: ['anxious', 'calm', 'angry'], genres: ['Инди'] },
  { id: '7LSn5it9bQhJqyfEq1PM3l', title: 'Wolf Totem', artist: 'The HU', dur: 338, img: 'ab67616d00004851a849f2dea216228f9039f3e9', moods: ['neutral', 'happy'], genres: ['Метал', 'Рок'] },
  { id: '07iytmjOnuUwFZypjXT5Pd', title: 'Тайван', artist: 'Ratabuzz', dur: 160, img: 'ab67616d0000485123cc27adbf03849ae11bdd7e', moods: ['anxious', 'calm', 'angry'], genres: ['Поп', 'Хип хоп, рэп'] },
  { id: '6li3jwWNPZayYpKNFV09Xp', title: 'Chigi Tigi Boom', artist: 'Bayartsengel & Anu', dur: 206, img: 'ab67616d00004851e4338c4134204ba7a285d0f6', moods: ['happy'], genres: ['Поп'] },
  { id: '4Zf2f4ubveUfomEBal89Ks', title: 'Хайр эзэнтэй', artist: 'Баярцэнгэл', dur: 200, img: 'ab67616d00004851e4338c4134204ba7a285d0f6', moods: ['calm', 'sad'], genres: ['Поп'] },
  { id: '0b0NdXlhihjMoE11hgNvxQ', title: 'Tonjoo', artist: 'Bayanjargal ft Luuya', dur: 175, img: 'ab67616d000048516ec1d6ac7b371840a42d1c52', moods: ['happy', 'neutral'], genres: ['Поп'] },
  { id: '7oiuvnrjILVa88I1FeCBfN', title: 'Нэргүй дуу', artist: 'Нисванис', dur: 313, img: 'ab67616d00004851ab8d603ff4b06be1f056f311', moods: ['sad', 'calm'], genres: ['Рок'] },
  { id: '5lhmKpKjEUAhPQjbKXyodn', title: 'Үгүйлэн санана', artist: 'Харанга', dur: 317, img: 'ab67616d00004851c07493f9dfe0e65b9a420525', moods: ['sad'], genres: ['Рок'] },
  { id: '2sNYoKlTPs16i41llZC429', title: 'Эсрэг утгаар нь', artist: 'Нисванис', dur: 246, img: 'ab67616d0000485187bb9df9d01c3379a8b2b3df', moods: ['neutral'], genres: ['Рок'] },
  { id: '2B6WsntfQSQ3yyctOY1hqT', title: 'Бүсгүй', artist: 'Хурд', dur: 300, img: 'ab67616d000048516cfc9ae0c871046a20bf743d', moods: ['calm', 'neutral'], genres: ['Рок'] },
  { id: '01B6BrR3dxAPje6gIedu9W', title: 'Аавдаа', artist: 'Хурд', dur: 316, img: 'ab67616d00004851796a4c3997205504e3df5205', moods: ['sad', 'tired'], genres: ['Рок'] },
  { id: '2QslFceV712W88cqFoz4g5', title: 'Аялгуу', artist: 'Харанга', dur: 329, img: 'ab67616d00004851c07493f9dfe0e65b9a420525', moods: ['calm', 'anxious', 'angry'], genres: ['Рок'] },
  { id: '00XFqNGAuPBb8OYHtGnfHG', title: 'Эвдэрхий хүн', artist: 'Rokit Bay ft. Uyanga', dur: 297, img: 'ab67616d00004851172aec74038ae019cad51090', moods: ['sad', 'anxious'], genres: ['Хип хоп, рэп'] },
  { id: '7DvH1Up90fn4lDw1MhfvIl', title: 'Яасан', artist: 'Big Gee', dur: 271, img: 'ab67616d00004851d241ce2095466e9bea9e5597', moods: ['sad'], genres: ['Хип хоп, рэп'] },
  { id: '2zfpkKF3wReQaA2KXGWeI2', title: 'Power', artist: 'Desant x Big Gee', dur: 146, img: 'ab67616d00004851fdef0c324668d338c4b3c1ce', moods: ['happy'], genres: ['Хип хоп, рэп'] },
  { id: '38BHidVS8TcUsOnSwh3btn', title: 'Одоо ч би хайртай хэвээр', artist: 'Big Gee ft. Nyamkhuu', dur: 190, img: 'ab67616d00004851a59d1c735950baac85707a3a', moods: ['sad', 'calm'], genres: ['Хип хоп, рэп'] },
  { id: '2W9W9j3WodIX8EpJ0F2TPc', title: 'Tengri: Mongol', artist: 'ThunderZ', dur: 192, img: 'ab67616d00004851a758ccc448dc124bf536bfa0', moods: ['happy'], genres: ['Хип хоп, рэп'] },
  { id: '0l3Kq8VVcMDDtrMV4lldGy', title: 'One Love (Ийм нэгэн дурлал)', artist: 'BX', dur: 287, img: 'ab67616d00004851628172a87ac1ec937740fe21', moods: ['happy', 'calm'], genres: ['R&B'] },
  { id: '7rJWcwXVdLNtJdRbBS6CKq', title: '100 хувь', artist: 'Egshiglen & BX', dur: 195, img: 'ab67616d00004851628172a87ac1ec937740fe21', moods: ['happy', 'neutral'], genres: ['R&B'] },
  { id: '626SEzzrSB41pPVC9SLm0g', title: 'This Is Mongol', artist: 'The HU', dur: 225, img: 'ab67616d000048511fbfed350d11b4dd839960e1', moods: ['happy'], genres: ['Метал', 'Рок'] },
  { id: '7IT6UOYMSWYCg32KuYhJGa', title: 'Echoes of My Father', artist: 'The HU', dur: 369, img: 'ab67616d000048514dfc05bd9d4867e7b35abc1e', moods: ['neutral'], genres: ['Метал', 'Рок'] },
  { id: '01fGofO0g4WxuAF4Ue9cvl', title: 'The Great Chinggis Khaan', artist: 'The HU', dur: 272, img: 'ab67616d00004851a849f2dea216228f9039f3e9', moods: ['neutral', 'happy'], genres: ['Метал', 'Рок'] },
  { id: '4VWia4zwaAj2QIkwQOKRKN', title: 'Warrior Chant', artist: 'The HU', dur: 227, img: 'ab67616d000048514dfc05bd9d4867e7b35abc1e', moods: ['happy'], genres: ['Метал'] },
  { id: '7m4yNM4eG748t9IVVL9dw1', title: 'Caroline', artist: 'Magnolian', dur: 281, img: 'ab67616d00004851bf20f073b27112543892306c', moods: ['neutral', 'calm'], genres: ['Инди'] },
  { id: '1zETDM7QUbjcUDAKdDlbSK', title: 'Primadonna', artist: 'Magnolian', dur: 249, img: 'ab67616d00004851bf20f073b27112543892306c', moods: ['happy'], genres: ['Инди'] },
  { id: '2UweSn50xGODUOhkKnjJf2', title: 'The Bride & the Bachelor', artist: 'Magnolian ft. Tselmuun', dur: 250, img: 'ab67616d00004851387b927cbb11c51b3ceb3a91', moods: ['sad', 'tired'], genres: ['Инди'] },
  { id: '3CwzWgBg0zcG9sqbVvyknv', title: 'Crimson', artist: 'Magnolian', dur: 187, img: 'ab67616d000048519a56202d734f75bec48fe2e4', moods: ['anxious'], genres: ['Инди'] },
];

export const MN_IDS = new Set(MN_SONGS.map(s => s.id));

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
    if (skip.has(s.id) || (!fits && !genre) || (s.genres.includes('Метал') && !hardAllowed(mood))) return [];
    const tier = genre ? (fits ? 0 : 1) : 2;
    return [{ s, genre, k: tier * 2 + (seen.has(s.id) ? 1 : 0) + rand() }];
  }).sort((a, b) => a.k - b.k).slice(0, n)
    .map(({ s, genre }) => ({ video_id: s.id, title: s.title, artist: s.artist, thumbnail: `https://i.scdn.co/image/${s.img}`, duration_s: s.dur, reason: genre ? `Таны сонгосон төрөл: ${genre}` : WHY[mood] }));
}

/** Хоёр жагсаалтыг ээлжлэн холино: a[0], b[0], a[1], b[1]… */
export function interleave<T>(a: T[], b: T[]) {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) { if (i < a.length) out.push(a[i]); if (i < b.length) out.push(b[i]); }
  return out;
}
