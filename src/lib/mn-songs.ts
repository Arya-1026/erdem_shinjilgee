/* ---------- Монгол дуунууд ----------
   LLM монгол дууны нэрийг зохиож хэлдэг, YouTube-ийн "Music" ангилалд ч ихэнх нь ордоггүй тул
   шалгасан бодит бичлэгүүдийг гараар жагсаасан. video_id шууд мэдэгдэж байгаа тул хайлтын квот зарцуулахгүй.
   Mood-ийг дууны нэр, төрлөөр нь оноосон. Эхний FEATURED дуу нь апп-ын ерөнхий зөвлөмжид (RECS) орно. */
import type { MoodId, SongRec } from './types';

export type MnSong = { id: string; title: string; artist: string; dur: number; moods: MoodId[] };

export const MN_SONGS: MnSong[] = [
  { id: 'cGAT-y6Ffss', title: 'Сэтгэлийн хүч', artist: 'Камертон', dur: 315, moods: ['sad', 'anxious', 'tired'] },
  { id: 'v22ASLZ5o4M', title: 'Гарагийн өдөр', artist: 'Luuya', dur: 169, moods: ['happy', 'neutral'] },
  { id: '0RaWPPxvfl4', title: 'Өвөлжөө', artist: 'Magnolian', dur: 337, moods: ['calm', 'tired'] },
  { id: 'v4xZUr0BEfE', title: 'Yuve Yuve Yu', artist: 'The HU', dur: 353, moods: ['angry', 'happy'] },
  { id: 'PiRNggf0Lu4', title: 'Нулимсаа тэвчье', artist: 'Хурд', dur: 348, moods: ['sad'] },
  { id: 'vCm-w0AQpCA', title: 'Тайван', artist: 'Ratabuzz', dur: 175, moods: ['anxious', 'calm'] },
  { id: 'Y7nfl9UtGuA', title: 'Амар мэндийн дуу', artist: 'Хурд', dur: 332, moods: ['neutral', 'calm', 'happy'] },
  { id: '7kUBpqg4_ZI', title: 'Муу зуршил', artist: 'Нисванис', dur: 287, moods: ['angry', 'neutral'] },
  { id: 'U8aua1UqijI', title: 'Амьдрал', artist: 'Харанга', dur: 551, moods: ['tired', 'sad', 'neutral'] },
  { id: 'NinVDQlmTp0', title: 'Woods', artist: 'Magnolian', dur: 214, moods: ['anxious', 'calm'] },
  { id: '_Z3mHnzTJMo', title: 'Chigi Tigi Boom', artist: 'Bayartsengel & Anu', dur: 206, moods: ['happy'] },
  { id: 'jM8dCGIm6yc', title: 'Wolf Totem', artist: 'The HU', dur: 397, moods: ['angry'] },
  { id: 'S9T1NSo1OVU', title: 'Асах гэрэл', artist: 'Камертон', dur: 286, moods: ['anxious', 'neutral'] },
  { id: 'e2VgPucnLSo', title: 'Нутгийн айзам', artist: 'Түмэн-Өлзий Жимсээ', dur: 185, moods: ['calm', 'tired'] },
  { id: 'RHK0sHv-LsE', title: 'Нэргүй дуу', artist: 'Нисванис', dur: 329, moods: ['sad', 'calm'] },
  { id: 'ChFnLzmpUoc', title: 'Бороо', artist: 'Харанга', dur: 248, moods: ['sad', 'calm'] },
  { id: 'Ak8LluYGDoY', title: 'Үгүйлэн санана', artist: 'Харанга', dur: 351, moods: ['sad'] },
  { id: 'gCOfB02ZRsk', title: 'Толин хул', artist: 'Харанга & Татар', dur: 294, moods: ['angry'] },
  { id: 'tWTAIasP4rk', title: 'Эсрэг утгаар нь', artist: 'Нисванис', dur: 243, moods: ['angry', 'neutral'] },
  { id: '4Y2gK4n35hw', title: 'This Is Mongol', artist: 'The HU', dur: 278, moods: ['happy', 'angry'] },
  { id: 'zP-MnSkCdYQ', title: 'Хөх толботон', artist: 'Алтан Ураг', dur: 222, moods: ['anxious', 'angry'] },
  { id: '6_KtTfifqsY', title: 'Бүсгүй', artist: 'Хурд', dur: 295, moods: ['calm', 'neutral'] },
  { id: 'L50uM-otc90', title: 'Аавдаа', artist: 'Хурд', dur: 352, moods: ['sad', 'tired'] },
  { id: '3-2Y3ijsOx4', title: 'Хайрын хот', artist: 'Камертон', dur: 249, moods: ['calm', 'happy'] },
  { id: 'Ud7iRe6kuE0', title: 'Гэгээн домог', artist: 'Болд', dur: 282, moods: ['neutral', 'calm'] },
  { id: '23HjASzVHGQ', title: 'Борооны үнэр', artist: 'Баярцэнгэл', dur: 221, moods: ['sad', 'tired'] },
  { id: 'HP28rLnAbXE', title: 'Tonjoo', artist: 'Bayanjargal ft Luuya', dur: 177, moods: ['happy', 'neutral'] },
  { id: 'FNHqSrcj5Ks', title: 'Сайн яваа хүний хань', artist: 'Энхзул', dur: 231, moods: ['calm', 'tired', 'anxious'] },
];

export const FEATURED = 14;
export const MN_IDS = new Set(MN_SONGS.map(s => s.id));
export const ytThumb = (id: string) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;

const WHY: Record<MoodId, string> = {
  happy: 'Сайхан өдрийн эрч хүчийг нэмэх монгол дуу', calm: 'Тайван мөчид зохих монгол дуу', neutral: 'Өдрөө дулаацуулах монгол дуу',
  tired: 'Ядарсан үед дулаахан сонсогдох монгол дуу', anxious: 'Сэтгэлийг амраах монгол дуу', sad: 'Сэтгэлд ойр монгол дуу', angry: 'Уураа хүч болгон гаргах монгол дуу',
};

/** Тухайн mood-д тохирох монгол дуунууд. skip: хасах (👎, өөрийн сан), seen: сүүлд гарсан тул хамгийн сүүлд тавих */
export function pickMongolian(mood: MoodId, skip: Set<string>, seen: Set<string>, n: number, rand = Math.random): SongRec[] {
  return MN_SONGS.filter(s => s.moods.includes(mood) && !skip.has(s.id))
    .map(s => ({ s, k: rand() + (seen.has(s.id) ? 1 : 0) }))
    .sort((a, b) => a.k - b.k).slice(0, n)
    .map(({ s }) => ({ video_id: s.id, title: s.title, artist: s.artist, thumbnail: ytThumb(s.id), duration_s: s.dur, reason: WHY[mood] }));
}

/** Хоёр жагсаалтыг ээлжлэн холино: a[0], b[0], a[1], b[1]… */
export function interleave<T>(a: T[], b: T[]) {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) { if (i < a.length) out.push(a[i]); if (i < b.length) out.push(b[i]); }
  return out;
}
