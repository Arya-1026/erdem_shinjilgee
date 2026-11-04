/* Хэрэглэгчийн сонгох апп-ын үндсэн өнгө. CSS утгууд нь globals.css-ийн [data-palette="..."]-д.
   Энд зөвхөн сонгох дэлгэцэнд харуулах өнгө (light). */
export type PaletteId = 'meadow' | 'water' | 'dawn' | 'lavender' | 'rose';

export const PALETTES: { id: PaletteId; label: string; desc: string; primary: string; soft: string; dark: string }[] = [
  { id: 'meadow',   label: 'Ногоон тал', desc: 'Тайван, тэнцвэртэй',   primary: '#2F7A6B', soft: '#DCEFEA', dark: '#6CC2AF' },
  { id: 'water',    label: 'Тайван ус',  desc: 'Сэрүүн, тунгалаг',     primary: '#36689E', soft: '#DDE7F3', dark: '#8FB4E3' },
  { id: 'dawn',     label: 'Үүр цайх',   desc: 'Дулаахан, эрч хүчтэй', primary: '#B5533B', soft: '#FBE3DA', dark: '#F0957C' },
  { id: 'lavender', label: 'Лаванда',    desc: 'Зөөлөн, мөрөөдөмтгий', primary: '#6A4FD8', soft: '#ECE7FB', dark: '#A996F2' },
  { id: 'rose',     label: 'Сарнай',     desc: 'Энхрий, халуун дулаан', primary: '#A8456A', soft: '#F8E1E8', dark: '#E79AB2' },
];

export const DEFAULT_PALETTE: PaletteId = 'meadow';
export const isPaletteId = (v: unknown): v is PaletteId => PALETTES.some(p => p.id === v);

/** Хуудас ачаалагдахад өнгө "анивчихгүй"-н тулд localStorage-д хадгалж, <head> дотроос шууд тавина */
export const PALETTE_KEY = 'setgel_palette';

export function applyPalette(id: PaletteId) {
  document.documentElement.dataset.palette = id;
  try { localStorage.setItem(PALETTE_KEY, id); } catch { /* хувийн горимд localStorage хаалттай байж болно */ }
  const meta = document.querySelector('meta[name="theme-color"]');
  const p = PALETTES.find(x => x.id === id);
  if (meta && p) meta.setAttribute('content', p.primary);
}
