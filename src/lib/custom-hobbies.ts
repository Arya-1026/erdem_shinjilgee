/* Хэрэглэгчийн өөрөө нэмсэн хобби: нэр нь profiles.hobbies-д, ангилал нь profiles.hobby_cats-д хадгалагдана. */

/** Нэрийг цэвэрлэнэ: илүү зай хасаж, 40 тэмдэгтээр таслана */
export const cleanHobby = (s: string) => s.trim().replace(/\s+/g, ' ').slice(0, 40);

/** Шинэ хобби нэмж болох уу: 2+ тэмдэгт, жагсаалтад (аль ч хэлээр) болон өмнө нэмсэнд байхгүй */
export function canAddHobby(name: string, known: Set<string>, selected: Iterable<string>) {
  const n = name.toLowerCase();
  return name.length > 1 && !known.has(n) && ![...selected].some(h => h.toLowerCase() === n);
}

/** DB-ээс ирсэн утгыг шалгаж, зөвхөн сонгогдсон хоббиудын, мэдэгдэх ангиллыг үлдээнэ */
export function pickHobbyCats(raw: unknown, selected: Iterable<string>, cats: Iterable<string>): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const sel = new Set(selected), ok = new Set(cats);
  return Object.fromEntries(Object.entries(raw as Record<string, unknown>).filter(([h, c]) => sel.has(h) && typeof c === 'string' && ok.has(c)) as [string, string][]);
}
