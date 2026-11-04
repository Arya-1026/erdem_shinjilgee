/* Улирлын чимэглэл. Огноогоор автоматаар асна, профайлаас хүчээр асаах/унтраах боломжтой (төхөөрөмж бүрт). */

export type Season = 'newyear';
export type SeasonPref = 'auto' | Season | 'off';

export const SEASONS: Record<Season, { label: string; greeting: string }> = {
  newyear: { label: '🎄 Шинэ жил', greeting: '🎄 Шинэ оны мэнд! Дулаахан халуун шоколад уугаад амраарай ☕' },
};

/** 12/15–1/5: Шинэ жил */
export function seasonFor(d: Date): Season | null {
  const m = d.getMonth() + 1, day = d.getDate();
  if ((m === 12 && day >= 15) || (m === 1 && day <= 5)) return 'newyear';
  return null;
}

export const resolveSeason = (pref: SeasonPref, d: Date): Season | null =>
  pref === 'off' ? null : pref === 'auto' ? seasonFor(d) : pref;

const KEY = 'setgel_season';
export const isSeasonPref = (v: unknown): v is SeasonPref => v === 'auto' || v === 'off' || v === 'newyear';

export function loadSeasonPref(): SeasonPref {
  try { const v = localStorage.getItem(KEY); return isSeasonPref(v) ? v : 'auto'; } catch { return 'auto'; }
}

export function saveSeasonPref(p: SeasonPref) {
  try { localStorage.setItem(KEY, p); } catch { /* хувийн горим */ }
  dispatchEvent(new Event('setgel-season'));
}
