import { describe, expect, it } from 'vitest';
import { contrast, customPalette, isPaletteId, paletteColors, paletteCss, PALETTES, themeVars } from './palettes';

const ids = [...PALETTES.map(p => p.id), customPalette('#ffee00'), customPalette('#000000'), customPalette('#ffffff', '#00ff00')];
const stops = (g: string) => g.match(/#[0-9a-f]{6}/gi)!;

describe('Апп-ын өнгө', () => {
  it('өнгөний тоо', () => {
    expect(PALETTES.filter(p => p.kind === 'gradient')).toHaveLength(8);
    expect(PALETTES.filter(p => p.kind === 'bold')).toHaveLength(8);
    expect(PALETTES.filter(p => p.kind === 'soft')).toHaveLength(5);
    expect(new Set(PALETTES.map(p => p.id)).size).toBe(PALETTES.length);
  });
  it('гэрэлтэй, харанхуйд бичиг уншигдана (өөрийн шар, цагаан, хар өнгөнд ч)', () => {
    for (const id of ids) for (const dark of [false, true]) {
      const v = themeVars(id, dark), msg = `${id} ${dark}`;
      expect(contrast(v['--primary'], v['--card']), msg).toBeGreaterThanOrEqual(4.5);
      expect(contrast(v['--primary'], v['--primary-foreground']), msg).toBeGreaterThanOrEqual(4.5);
      expect(contrast(v['--secondary-foreground'], v['--secondary']), msg).toBeGreaterThanOrEqual(4.5);
      for (const s of stops(v['--grad'])) expect(contrast(s, v['--primary-foreground']), msg).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('өөрийн өнгийг шалгаж уншина', () => {
    expect(isPaletteId('custom:#aabbcc')).toBe(true);
    expect(isPaletteId('custom:#aabbcc:#112233')).toBe(true);
    expect(isPaletteId('custom:red')).toBe(false);
    expect(isPaletteId('custom:#aabbcc;}body{display:none')).toBe(false);
    expect(isPaletteId('unknown')).toBe(false);
    expect(paletteColors('custom:#aabbcc:#112233')).toEqual({ from: '#aabbcc', to: '#112233' });
  });
  it('өнгө бүр өөр CSS гаргана', () => {
    expect(paletteCss('neon')).not.toBe(paletteCss('crimson'));
    expect(paletteCss('neon')).toContain('html.dark{');
  });
});
