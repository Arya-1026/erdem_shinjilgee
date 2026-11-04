import { RECS } from './data';
import type { Mood, ScoredRec } from './types';

// Оноо: mood таарвал +3, хоббид таарвал +2, 👍 бол +1, 👎 бол хасагдана
export function scoredRecs(m: Mood, hobbies: string[], feedback: Record<string, number>): ScoredRec[] {
  return RECS.map(r => {
    const fb = feedback[r.id] || 0;
    const hob = (r.hobby || []).some(h => hobbies.includes(h));
    return { ...r, hob, fb, score: (r.moods.includes(m.id) ? 3 : 0) + (hob ? 2 : 0) + (fb === 1 ? 1 : fb === -1 ? -10 : 0) };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score);
}
