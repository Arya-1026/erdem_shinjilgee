import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearUserStorage, USER_STORAGE_KEYS } from './user-storage';

function fakeStorage(init: Record<string, string>) {
  const m = new Map(Object.entries(init));
  vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) });
  return m;
}

describe('Гарах үед хэрэглэгчийн localStorage цэвэрлэх', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('өмнөх хэрэглэгчийн хувийн өгөгдлийг (DASS хариулт, үзсэн кино, мэдэгдэл…) устгана', () => {
    const m = fakeStorage(Object.fromEntries(USER_STORAGE_KEYS.map(k => [k, 'A-гийн өгөгдөл'])));
    clearUserStorage();
    for (const k of USER_STORAGE_KEYS) expect(m.has(k)).toBe(false);
  });

  it('DASS-ийн дуусаагүй хариултыг заавал цэвэрлэнэ', () => {
    expect(USER_STORAGE_KEYS).toContain('setgel-dass-progress');
  });

  it('төхөөрөмжийн тохиргоог (өнгө, дуу, амьтан) хэвээр үлдээнэ', () => {
    const m = fakeStorage({ 'setgel-palette': 'x', 'setgel-breath-sound': 'off', 'setgel-pet': 'cat', 'setgel-dass-progress': '[1,2]' });
    clearUserStorage();
    expect([...m.keys()].sort()).toEqual(['setgel-breath-sound', 'setgel-palette', 'setgel-pet']);
  });

  it('localStorage хаалттай (хувийн цонх) бол алдаа шидэхгүй', () => {
    vi.stubGlobal('localStorage', { removeItem: () => { throw new Error('blocked'); } });
    expect(() => clearUserStorage()).not.toThrow();
  });
});
