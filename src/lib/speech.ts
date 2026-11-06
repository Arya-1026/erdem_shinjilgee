/* Яриа таних хөтчийн үр дүнг давхардалгүй болгох.
   Chrome (ялангуяа Android) continuous горимд ижил үр дүнг дахин өгдөг:
   - resultIndex 0 хэвээр үлдэж, өмнөх эцсийн үр дүнгүүд дахин ирдэг
   - дараагийн үр дүн өмнөхөө агуулж ирдэг: «сайн», «сайн байна», «сайн байна уу» */

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const key = (w: string) => w.toLowerCase().replace(/[.,!?;:…"«»]/g, '');

/** heard-ийн төгсгөлтэй давхцаагүй, text-ийн шинэ хэсэг */
export function newWords(heard: string[], text: string[]) {
  for (let k = Math.min(heard.length, text.length); k > 0; k--) {
    if (text.slice(0, k).every((w, i) => key(w) === key(heard[heard.length - k + i]))) return text.slice(k);
  }
  return text;
}

/** Нэг удаагийн сонсолтын шүүлтүүр: эцсийн үр дүн бүрийг өгөхөд зөвхөн шинэ хэсгийг буцаана */
export function speechFilter() {
  const seen: string[] = [];
  const heard: string[] = [];
  return (index: number, transcript: string) => {
    if (seen[index] === transcript) return '';
    seen[index] = transcript;
    const fresh = newWords(heard, words(transcript));
    heard.push(...fresh);
    return fresh.join(' ');
  };
}
