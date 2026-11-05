/* Spotify-ийн дуунд тохирох YouTube бичлэг сонгох цэвэр функцууд */

const decode = (s: string) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const norm = (s: string) => decode(s).toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, '');

/** "Song (Mongolian Version)", "Song - Remastered" → "Song" */
const cleanTitle = (title: string) => title.replace(/\s*[([].*?[)\]]/g, '').replace(/\s+[-–—]\s+.*$/, '').trim();
const firstArtist = (artist: string) => artist.split(/,\s*|\s+(?:ft\.?|feat\.?|x|&)\s+/i)[0].trim();

export const videoQuery = (artist: string, title: string) => [firstArtist(artist), cleanTitle(title)].filter(Boolean).join(' ');

/** Анхны дуу биш хувилбарууд */
const VARIANT = /\b(cover|karaoke|remix|sped up|slowed|reaction|instrumental|tutorial|lesson|8d|nightcore|1 hour|loop)\b/i;

export type VideoHit = { id: string; title: string; channel: string };

/** Хамгийн тохирох бичлэг. Дууны нэр гарчигт байхгүй бол буруу дуу тоглуулахгүйн тулд null. */
export function pickVideo(items: VideoHit[], artist: string, title: string) {
  const song = norm(cleanTitle(title)), singer = norm(firstArtist(artist));
  const scored = items.flatMap((v, i) => {
    const text = decode(v.title), name = norm(text), channel = norm(v.channel);
    if (song && !name.includes(song)) return [];
    const variant = VARIANT.test(text) && !VARIANT.test(title);
    const score = (singer && (name.includes(singer) || channel.includes(singer)) ? 2 : 0)
      + (/ - Topic$|VEVO$/i.test(v.channel) ? 2 : 0) + (/official/i.test(text) ? 1 : 0) - (variant ? 5 : 0);
    return [{ id: v.id, score, i }];
  });
  // Ижил оноотой бол YouTube-ийн эрэмбэ
  return scored.sort((a, b) => b.score - a.score || a.i - b.i)[0]?.id ?? null;
}
