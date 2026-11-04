/* YouTube Data API-ийн хариуг манай хэлбэрт оруулах цэвэр функцууд */

/** ISO 8601 хугацаа ("PT1H2M3S") → секунд */
export function parseIsoDuration(iso: string | undefined | null) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso ?? '');
  if (!m) return 0;
  const [, d, h, min, s] = m.map(x => Number(x ?? 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}

type Thumbs = Partial<Record<'default' | 'medium' | 'high' | 'standard' | 'maxres', { url: string }>>;
/** 320×180 хэмжээний зураг (жагсаалтад хангалттай) */
export const pickThumb = (t: Thumbs | undefined) => t?.medium?.url ?? t?.high?.url ?? t?.default?.url ?? null;

const NOISE = /\s*[([](official|lyrics?|audio|video|mv|m\/v|hd|hq|4k|visuali[sz]er|live|remaster(ed)?|clip|full|music video|lyric video)[^)\]]*[)\]]/gi;

/** "Adele - Someone Like You (Official Video)" → { artist: 'Adele', song: 'Someone Like You' }. Танихгүй бол null. */
export function splitTitle(title: string, channel = ''): { artist: string; song: string } | null {
  const clean = title.replace(NOISE, '').replace(/\s+/g, ' ').trim();
  const parts = clean.split(/\s+[-–—|]\s+/);
  if (parts.length >= 2) return { artist: parts[0].trim(), song: parts.slice(1).join(' - ').trim() };
  const ch = channel.replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim();
  return ch ? { artist: ch, song: clean } : null;
}

/** Cache-ийн түлхүүр: том жижиг үсэг, цэг таслал, илүү зайг үл тооно */
export const songKey = (artist: string, title: string) =>
  `${artist} ${title}`.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
