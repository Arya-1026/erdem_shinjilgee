/* Spotify Web API-ийн хариуг манай хэлбэрт оруулах цэвэр функцууд.
   2026.02-оос playlist-ийн мөрийн дуу `item` талбарт ирдэг (`track` нь хуучирсан, заримдаа boolean). */
export type SpotifyTrack = { id: string; name: string; artists: string; image: string | null; uri: string; duration_ms: number };

type Img = { url: string; width?: number | null };
type RawTrack = {
  type?: string; id?: string | null; name?: string; uri?: string; duration_ms?: number; is_local?: boolean;
  artists?: { name: string }[]; album?: { images?: Img[] };
};

// Жижиг (64px орчим) зургийг сонгоно. Spotify ихэвчлэн томоос жижиг рүү эрэмбэлдэг.
export function pickImage(images: Img[] | undefined) {
  if (!images?.length) return null;
  const sorted = [...images].sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
  return (sorted.find(i => (i.width ?? 0) >= 64) ?? sorted[sorted.length - 1]).url;
}

export function toTrack(raw: unknown): SpotifyTrack | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as RawTrack;
  if ((t.type && t.type !== 'track') || t.is_local || !t.id || !t.uri || !t.name) return null;
  return {
    id: t.id, name: t.name, uri: t.uri, duration_ms: t.duration_ms ?? 0,
    artists: (t.artists ?? []).map(a => a.name).join(', '),
    image: pickImage(t.album?.images),
  };
}

/** Playlist-ийн нэг мөрөөс дууг гаргана (шинэ `item`, хуучин `track` хоёуланг дэмжинэ) */
export function playlistEntryTrack(entry: unknown): SpotifyTrack | null {
  if (!entry || typeof entry !== 'object') return null;
  const e = entry as { item?: unknown; track?: unknown; is_local?: boolean };
  if (e.is_local) return null;
  return toTrack(typeof e.item === 'object' ? e.item : typeof e.track === 'object' ? e.track : null);
}

/** spotify:track:ID хаягийг вэб холбоос болгоно: утсан дээр Spotify апп, бусад үед вэб тоглуулагчаар нээгдэнэ */
export function spotifyTrackUrl(uri: string | null | undefined) {
  const id = uri?.match(/^spotify:track:([A-Za-z0-9]+)$/)?.[1];
  return id ? `https://open.spotify.com/track/${id}` : null;
}

/** Cache-ийн түлхүүр: том жижиг үсэг, цэг таслал, илүү зайг үл тооно */
export const songKey = (artist: string, title: string) =>
  `${artist} ${title}`.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

// Хаалт доторх «Remastered», «feat. ...», « - Live» зэргийг хаяж, үсэг тоог л харьцуулна
const words = (s: string) => s.toLowerCase().normalize('NFKC').replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/\s[-–—]\s.*$/, ' ').split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 1);

/** Олдсон дууны нэр хүссэн нэртэй таарах уу. Таараагүй дууг санал болгосон нэрээр нь харуулж, өөр дуу тоглуулахгүйн тулд. */
export function sameTitle(wanted: string, got: string) {
  const a = words(wanted), b = words(got);
  if (!a.length || !b.length) return false;
  const ja = a.join(''), jb = b.join('');
  if (ja.includes(jb) || jb.includes(ja)) return true;
  const set = new Set(b);
  return a.filter(w => set.has(w)).length / a.length >= 0.6;
}
