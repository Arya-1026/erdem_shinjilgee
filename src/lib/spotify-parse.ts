/* Spotify Web API-ийн хариуг манай хэлбэрт оруулах цэвэр функцууд.
   2026.02-оос playlist-ийн мөрийн дуу `item` талбарт ирдэг (`track` нь хуучирсан, заримдаа boolean). */
export type SpotifyTrack = { id: string; name: string; artists: string; image: string | null; uri: string; duration_ms: number };

/**
 * Хэрэглэгчийн буулгасан бичвэрээс дууны id-уудыг гаргана. Spotify-аас хуулахад мөр бүрт нэг холбоос ирдэг.
 * otherLinks: дууны биш (playlist, цомог) холбоос байгаа эсэх: тэдгээрийн дууг API-аар уншиж чадахгүй.
 */
export function parseTrackIds(text: string) {
  const ids = [...text.matchAll(/(?:open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/|spotify:track:)([A-Za-z0-9]{22})(?![A-Za-z0-9])/g)].map(m => m[1]);
  return { ids: [...new Set(ids)], otherLinks: /open\.spotify\.com\/(?:intl-[a-z-]+\/)?(?:playlist|album|artist)\/|spotify:(?:playlist|album|artist):/.test(text) };
}

/** Нийтийн oEmbed хариуг дуу болгоно. Энэ хариу дуучин, үргэлжлэх хугацаа өгдөггүй: тоглуулагч хугацааг өөрөө мэдээлнэ. */
export function oembedTrack(id: string, raw: unknown): SpotifyTrack | null {
  if (!raw || typeof raw !== 'object') return null;
  const { title, thumbnail_url: img } = raw as { title?: unknown; thumbnail_url?: unknown };
  if (typeof title !== 'string' || !title.trim()) return null;
  return { id, name: title.trim().slice(0, 300), artists: '', image: typeof img === 'string' && img.startsWith('https://') ? img : null, uri: `spotify:track:${id}`, duration_ms: 0 };
}

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
