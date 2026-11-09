/* =========================================================
   Spotify тоглуулалт (зөвхөн браузерт): Embed (iFrame API).
   Spotify бүртгэл холбодоггүй тул апп дотор 30 орчим секундын хэсэг тоглоно. Бүтэн дууг UI-ийн «Spotify-д нээх» холбоосоор сонсоно.
   ========================================================= */
export type SpState = { position: number; duration: number; paused: boolean };
type OnState = (s: SpState) => void;

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.async = true; s.onload = () => resolve(); s.onerror = () => reject(new Error('script ' + src));
    document.body.appendChild(s);
  });
}

let embedCtl: Promise<SpotifyEmbedController> | null = null;

/** `host` элементийг Spotify embed-ээр солино. Энэ элемент DOM-д байнга байх ёстой.
 *  Анх ачаалахад 10 гаруй секунд зарцуулдаг тул санал болгосон дуу харагдмагц урьдчилан дуудна (prime).
 *  Нуусан (visibility: hidden, дэлгэцээс гадна) элемент бэлэн болдоггүй тул ил тод бус байдлаар дэлгэцэн дээр байлгана. */
export function initEmbed(host: HTMLElement, firstUri: string, onState: OnState) {
  if (embedCtl) return embedCtl;
  embedCtl = new Promise(resolve => {
    window.onSpotifyIframeApiReady = api => {
      api.createController(host, { uri: firstUri, width: '100%', height: 80 }, ctl => {
        ctl.addListener('playback_update', e => onState({ position: e.data.position / 1000, duration: e.data.duration / 1000, paused: e.data.isPaused }));
        // play() нь embed бэлэн болсны дараа л ажиллана
        ctl.addListener('ready', () => resolve(ctl));
      });
    };
    void loadScript('https://open.spotify.com/embed/iframe-api/v1');
  });
  return embedCtl;
}

export async function embedPlay(host: HTMLElement, uri: string, atSec: number, onState: OnState) {
  const fresh = !embedCtl;
  const ctl = await initEmbed(host, uri, onState);
  if (!fresh) ctl.loadUri(uri);
  ctl.play();
  if (atSec > 1) setTimeout(() => ctl.seek(atSec), 800);
}
export const embed = {
  pause: () => void embedCtl?.then(c => c.pause()),
  resume: () => void embedCtl?.then(c => c.resume()),
  seek: (sec: number) => void embedCtl?.then(c => c.seek(sec)),
};
