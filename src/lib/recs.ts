import { GENRE_CAT, HOBBIES, LEGACY_HOBBIES, RECS } from './data';
import type { Mood, ScoredRec } from './types';

/** Хобби → ангилал (хуучин ерөнхий сонголтыг оруулаад) */
export const CATEGORY_OF = new Map<string, string>([
  ...Object.entries(HOBBIES).filter(([c]) => c !== GENRE_CAT).flatMap(([c, items]) => items.map(h => [h, c] as const)),
  ...Object.entries(LEGACY_HOBBIES),
]);

/** Хоббид тохирох дасгал цөөн бол mood-д тохирохоор ийм тоо хүртэл нөхнө */
export const MIN_RECS = 3;

/* Зөвхөн тухайн хүнд тохирох дасгал:
   1) хоббид нь шууд таарсан (mood үл хамааран),
   2) ижил ангиллын хоббид таарсан бөгөөд одоогийн mood-д тохирох.
   Ийм дасгал MIN_RECS-ээс цөөн бол mood-д хамгийн тохирохоор нөхнө (хоосон харагдуулахгүй).
   Эрэмбэ: шууд хобби +3, ангилал +1, mood +2, 👍 +1. 👎 дарсныг хасна. */
export function scoredRecs(m: Mood, hobbies: string[], feedback: Record<string, number>): ScoredRec[] {
  const cats = new Set(hobbies.map(h => CATEGORY_OF.get(h)).filter(Boolean));
  const all = RECS.map(r => {
    const fb = feedback[r.id] || 0;
    const exact = (r.hobby || []).some(h => hobbies.includes(h));
    const near = !exact && (r.hobby || []).some(h => cats.has(CATEGORY_OF.get(h)));
    const mood = r.moods.includes(m.id);
    const fits = exact || (near && mood);
    const score = (exact ? 3 : 0) + (near ? 1 : 0) + (mood ? 2 : 0) + (fb === 1 ? 1 : 0);
    return { rec: { ...r, hob: fits, fb, score } as ScoredRec, mood };
  }).filter(x => x.rec.fb !== -1).sort((a, b) => b.rec.score - a.rec.score);

  const fit = all.filter(x => x.rec.hob).map(x => x.rec);
  const fill = fit.length < MIN_RECS ? all.filter(x => !x.rec.hob && x.mood).slice(0, MIN_RECS - fit.length).map(x => x.rec) : [];
  return [...fit, ...fill];
}
