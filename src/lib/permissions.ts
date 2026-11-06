/* Микрофон, камерын зөвшөөрөл. Вэб хуудас хөтчийн тохиргооны хуудсыг шууд нээх боломжгүй тул:
   - 'prompt' үед getUserMedia дуудаж хөтчийн өөрийн «Зөвшөөрөх үү?» цонхыг гаргана;
   - 'denied' үед хаягийн мөрийн 🔒 дүрсээр хэрхэн зөвшөөрөхийг зааж, төлөв өөрчлөгдөхийг хүлээнэ. */
export type DeviceKind = 'microphone' | 'camera';
export type PermState = 'granted' | 'denied' | 'prompt' | 'unsupported';

const supported = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && window.isSecureContext;

async function status(kind: DeviceKind): Promise<PermissionStatus | null> {
  try { return await navigator.permissions.query({ name: kind as PermissionName }); } catch { return null; } // Firefox, хуучин Safari
}

/** Одоогийн төлөв. Permissions API байхгүй хөтөч дээр 'prompt' гэж үзнэ (getUserMedia өөрөө асууна). */
export async function permissionState(kind: DeviceKind): Promise<PermState> {
  if (!supported()) return 'unsupported';
  const s = await status(kind);
  return (s?.state as PermState | undefined) ?? 'prompt';
}

/** Хөтчийн зөвшөөрлийн цонхыг гаргана. Амжилттай бол урсгалыг шууд зогсооно (зөвхөн зөвшөөрөл авах зорилготой). */
export async function requestPermission(kind: DeviceKind): Promise<PermState> {
  if (!supported()) return 'unsupported';
  try {
    const stream = await navigator.mediaDevices.getUserMedia(kind === 'microphone' ? { audio: true } : { video: true });
    stream.getTracks().forEach(t => t.stop());
    return 'granted';
  } catch (e) {
    const name = (e as DOMException)?.name;
    // NotFoundError: төхөөрөмж алга. Зөвшөөрлийн асуудал биш.
    if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'unsupported';
    return 'denied';
  }
}

/** Хэрэглэгч хөтчийн тохиргооноос зөвшөөрөл өөрчлөхөд дуудагдана. Буцаах функц нь сонсохоо болино. */
export function watchPermission(kind: DeviceKind, cb: (s: PermState) => void): () => void {
  let alive = true, st: PermissionStatus | null = null;
  const on = () => { if (st) cb(st.state as PermState); };
  void status(kind).then(s => { if (!alive || !s) return; st = s; s.addEventListener('change', on); });
  return () => { alive = false; st?.removeEventListener('change', on); };
}

/** Хэрэглэгчийн төхөөрөмж: зааврыг тохируулж харуулна */
export function browserHint(): 'ios' | 'android' | 'desktop' {
  if (typeof navigator === 'undefined') return 'desktop';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
  return /Android/.test(ua) ? 'android' : 'desktop';
}
