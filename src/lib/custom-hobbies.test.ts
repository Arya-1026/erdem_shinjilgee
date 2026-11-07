import { describe, expect, it } from 'vitest';
import { canAddHobby, cleanHobby, pickHobbyCats } from './custom-hobbies';

describe('өөрийн нэмсэн хобби', () => {
  const known = new Set(['гитар', 'guitar']);

  it('нэрийг цэвэрлээд давхардлыг шалгана', () => {
    expect(cleanHobby('  Морин   хуур ')).toBe('Морин хуур');
    expect(canAddHobby('Укулеле', known, ['Гүйлт'])).toBe(true);
    expect(canAddHobby('Гитар', known, [])).toBe(false);
    expect(canAddHobby('укулеле', known, ['Укулеле'])).toBe(false);
    expect(canAddHobby('У', known, [])).toBe(false);
  });

  it('зөвхөн сонгосон хобби, мэдэгдэх ангиллыг үлдээнэ', () => {
    const raw = { Укулеле: 'Хөгжим', Хасагдсан: 'Хөгжим', Буруу: 'Байхгүй', Тоо: 5 };
    expect(pickHobbyCats(raw, ['Укулеле', 'Буруу', 'Тоо'], ['Хөгжим'])).toEqual({ Укулеле: 'Хөгжим' });
    expect(pickHobbyCats(null, ['Укулеле'], ['Хөгжим'])).toEqual({});
    expect(pickHobbyCats(['x'], ['x'], ['Хөгжим'])).toEqual({});
  });
});
