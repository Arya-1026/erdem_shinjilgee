/* Хэрэглэгчийн сонгох апп-ын өнгө. Нэг эсвэл хоёр өнгөнөөс бүх системийн CSS хувьсагчийг тооцно:
   дэвсгэр, карт, хүрээ, товч, цэс, график. Унших чадварыг алдагдуулахгүйн тулд гол өнгийг
   дэвсгэртэй нь харьцуулж (WCAG 4.5:1) шаардлагатай бол бараан/цайвар болгоно. */
export type PaletteId = string;
export type PaletteKind = 'soft' | 'gradient' | 'bold';
export type Palette = { id: string; label: string; desc: string; kind: PaletteKind; from: string; to: string };

export const PALETTES: Palette[] = [
  { id: 'meadow',   kind: 'soft', label: 'Ногоон тал', desc: 'Тайван, тэнцвэртэй',    from: '#2F7A6B', to: '#6CC2AF' },
  { id: 'water',    kind: 'soft', label: 'Тайван ус',  desc: 'Сэрүүн, тунгалаг',      from: '#36689E', to: '#8FB4E3' },
  { id: 'dawn',     kind: 'soft', label: 'Үүр цайх',   desc: 'Дулаахан, эрч хүчтэй',  from: '#B5533B', to: '#F0957C' },
  { id: 'lavender', kind: 'soft', label: 'Лаванда',    desc: 'Зөөлөн, мөрөөдөмтгий',  from: '#6A4FD8', to: '#A996F2' },
  { id: 'rose',     kind: 'soft', label: 'Сарнай',     desc: 'Энхрий, халуун дулаан', from: '#A8456A', to: '#E79AB2' },

  { id: 'aurora',   kind: 'gradient', label: 'Туяа',      desc: 'Ногооноос ягаан',      from: '#00C9A7', to: '#845EC2' },
  { id: 'sunset',   kind: 'gradient', label: 'Нар жаргах', desc: 'Улаанаас шар',         from: '#FF5F6D', to: '#FFC371' },
  { id: 'ocean',    kind: 'gradient', label: 'Далай',     desc: 'Гүн хөхөөс цэнхэр',    from: '#0052D4', to: '#4FC3F7' },
  { id: 'berry',    kind: 'gradient', label: 'Жимс',      desc: 'Ягаанаас нил',         from: '#F72585', to: '#7209B7' },
  { id: 'flame',    kind: 'gradient', label: 'Дөл',       desc: 'Халуун улаан',         from: '#FF416C', to: '#FF8C00' },
  { id: 'neon',     kind: 'gradient', label: 'Неон',      desc: 'Гэрэлтэй ногоон, хөх', from: '#00E5A0', to: '#00B8F5' },
  { id: 'galaxy',   kind: 'gradient', label: 'Галактик',  desc: 'Нил ягаан сансар',     from: '#4A00E0', to: '#C026D3' },
  { id: 'peach',    kind: 'gradient', label: 'Тоор',      desc: 'Зөөлөн улбар шар',     from: '#FF9A8B', to: '#FF6A88' },

  { id: 'crimson',  kind: 'bold', label: 'Час улаан',   desc: 'Гүн, хүчтэй',     from: '#C1121F', to: '#E5383B' },
  { id: 'cobalt',   kind: 'bold', label: 'Кобальт',     desc: 'Гүн хөх',         from: '#0047AB', to: '#2F6FDE' },
  { id: 'emerald',  kind: 'bold', label: 'Маргад',      desc: 'Гүн ногоон',      from: '#00704A', to: '#00A36C' },
  { id: 'violet',   kind: 'bold', label: 'Нил ягаан',   desc: 'Тод, гүн',        from: '#5B21B6', to: '#7C3AED' },
  { id: 'fuchsia',  kind: 'bold', label: 'Фуксиа',      desc: 'Тод ягаан',       from: '#C2185B', to: '#E91E63' },
  { id: 'amber',    kind: 'bold', label: 'Хув',         desc: 'Дулаан шар',      from: '#B45309', to: '#F59E0B' },
  { id: 'teal',     kind: 'bold', label: 'Цэнхэр ногоон', desc: 'Гүн, тунгалаг', from: '#006D77', to: '#00A6B4' },
  { id: 'navy',     kind: 'bold', label: 'Шөнийн хөх',  desc: 'Бараан, тайван',  from: '#1E2A78', to: '#3F51B5' },
];

export const PALETTE_GROUPS: [PaletteKind, string][] = [['soft', 'Зөөлөн'], ['gradient', 'Градиент'], ['bold', 'Гүн тод']];

export const DEFAULT_PALETTE: PaletteId = 'meadow';
const CUSTOM = /^custom:(#[0-9a-f]{6})(?::(#[0-9a-f]{6}))?$/;
export const customPalette = (from: string, to?: string) => `custom:${from.toLowerCase()}${to ? ':' + to.toLowerCase() : ''}`;
export const isPaletteId = (v: unknown): v is PaletteId => typeof v === 'string' && (PALETTES.some(p => p.id === v) || CUSTOM.test(v));

/** Палитрын хоёр өнгө. Нэг өнгөтэй өөрийн өнгөнд хоёр дахь өнгийг цайвар хувилбараар нь авна. */
export function paletteColors(id: PaletteId): { from: string; to: string } {
  const c = CUSTOM.exec(id);
  if (c) return { from: c[1], to: c[2] ?? mix('#ffffff', c[1], 0.35) };
  const p = PALETTES.find(x => x.id === id) ?? PALETTES[0];
  return { from: p.from, to: p.to };
}

/* ---------- Өнгөний тооцоо ---------- */
const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const hex = (c: number[]) => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
/** a өнгөнд b-г t хэмжээгээр холино */
export function mix(a: string, b: string, t: number) {
  const x = rgb(a), y = rgb(b);
  return hex(x.map((v, i) => v + (y[i] - v) * t));
}
const lum = (h: string) => {
  const [r, g, b] = rgb(h).map(v => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export function contrast(a: string, b: string) {
  const x = lum(a), y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/** color-ыг toward чиглэлд бага багаар өөрчилж against-тай ratio хүрэх хүртэл тодруулна */
function readable(color: string, toward: string, against: string, ratio: number) {
  let c = color;
  for (let t = 0.04; contrast(c, against) < ratio && t <= 1; t += 0.04) c = mix(color, toward, t);
  return c;
}

const INK = '#10141A';

/** Гэрэлтэй, харанхуй горимын CSS хувьсагчид */
export function themeVars(id: PaletteId, dark: boolean): Record<string, string> {
  const { from, to } = paletteColors(id);
  if (dark) {
    const card = mix('#211E1B', from, 0.1), primary = readable(from, '#ffffff', card, 5);
    const a = readable(from, '#ffffff', INK, 5), b = readable(to, '#ffffff', INK, 5);
    return {
      '--background': mix('#171513', from, 0.08), '--card': card, '--popover': card, '--muted': mix('#2A2622', from, 0.14),
      '--border': mix('#3A352F', from, 0.24), '--input': mix('#3A352F', from, 0.24),
      '--primary': primary, '--primary-2': b, '--primary-foreground': INK,
      '--secondary': mix('#211E1B', from, 0.3), '--secondary-foreground': readable(primary, '#ffffff', mix('#211E1B', from, 0.3), 4.5),
      '--accent': mix('#211E1B', from, 0.3), '--ring': primary, '--chart-line': primary, '--chart-grid': mix('#3A352F', from, 0.24),
      '--grad': `linear-gradient(135deg, ${a}, ${b})`,
      '--wash': `linear-gradient(160deg, ${mix('#171513', from, 0.2)}, ${mix('#171513', to, 0.14)})`,
      '--nav-bg': mix('#1C1917', from, 0.16),
      '--shadow': 'none',
    };
  }
  const primary = readable(from, '#000000', '#ffffff', 4.8);
  const a = readable(from, '#000000', '#ffffff', 4.6), b = readable(to, '#000000', '#ffffff', 4.6);
  const secondary = mix('#ffffff', from, 0.16);
  return {
    '--background': mix('#FBF9F6', from, 0.08), '--card': mix('#ffffff', from, 0.02), '--popover': '#ffffff', '--muted': mix('#F2EEE8', from, 0.1),
    '--border': mix('#E6E0D7', from, 0.22), '--input': mix('#E6E0D7', from, 0.22),
    '--primary': primary, '--primary-2': b, '--primary-foreground': '#ffffff',
    '--secondary': secondary, '--secondary-foreground': readable(primary, '#000000', secondary, 4.5),
    '--accent': secondary, '--ring': primary, '--chart-line': primary, '--chart-grid': mix('#E6E0D7', from, 0.22),
    '--grad': `linear-gradient(135deg, ${a}, ${b})`,
    '--wash': `linear-gradient(160deg, ${mix('#FBF9F6', from, 0.2)}, ${mix('#FBF9F6', to, 0.16)})`,
    '--nav-bg': mix('#ffffff', from, 0.07),
    '--shadow': `0 8px 22px -16px ${from}`,
  };
}

const block = (v: Record<string, string>) => Object.entries(v).map(([k, x]) => `${k}:${x}`).join(';');
export const paletteCss = (id: PaletteId) => `html:not(.dark){${block(themeVars(id, false))}}html.dark{${block(themeVars(id, true))}}`;

/** Хуудас ачаалагдахад өнгө "анивчихгүй"-н тулд CSS-ийг localStorage-д хадгалж, <head> дотроос шууд тавина */
export const PALETTE_KEY = 'setgel_palette_css';
export const PALETTE_STYLE_ID = 'setgel-palette';

export function applyPalette(id: PaletteId) {
  const css = paletteCss(id);
  let el = document.getElementById(PALETTE_STYLE_ID);
  if (!el) { el = document.createElement('style'); el.id = PALETTE_STYLE_ID; document.head.appendChild(el); }
  el.textContent = css;
  try { localStorage.setItem(PALETTE_KEY, css); } catch { /* хувийн горимд localStorage хаалттай байж болно */ }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeVars(id, false)['--primary']);
}
