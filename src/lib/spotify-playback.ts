/* =========================================================
   Spotify тоглуулалт (зөвхөн браузерт).
   1) Web Playback SDK: Premium хэрэглэгчид апп дотроо бүтэн дуу тоглуулна.
   2) Embed (iFrame API): Premium-гүй үед. Нэвтрээгүй бол 30 сек preview; үнэгүй бүртгэлд бүтэн тоглох нь баталгаагүй тул UI-д «Spotify-д нээх» холбоос байна.
   2026.02-оос /me нь `product` (Premium эсэх) буцаахгүй тул SDK-ийн account_error-оор ялгана.
   ========================================================= */
export type SpState = { position: number; duration: number; paused: boolean };
type OnState = (s: SpState) => void;

/* ---------- Access token (/api/spotify/token) ---------- */
let tok: { token: string; expiresAt: number } | null = null;
async function token() {
  if (tok && tok.expiresAt - Date.now() > 60_000) return tok.token;
  const res = await fetch('/api/spotify/token', { cache: 'no-store' });
  if (!res.ok) throw new Error('token ' + res.status);
  tok = await res.json();
  return tok!.token;
}

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.async = true; s.onload = () => resolve(); s.onerror = () => reject(new Error('script ' + src));
    document.body.appendChild(s);
  });
}

/* ---------- 1) Web Playback SDK ---------- */
let sdkPlayer: Spotify.Player | null = null;
let sdkDevice: Promise<string> | null = null;

export class PremiumRequired extends Error {}

/** SDK-г ачаалж, апп-ыг Spotify "төхөөрөмж" болгоно. Premium биш бол PremiumRequired шиднэ. */
export function initSdk(onState: OnState): Promise<string> {
  if (sdkDevice) return sdkDevice;
  sdkDevice = new Promise<string>((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => {
      const p = new window.Spotify.Player({ name: 'Сэтгэл (вэб)', volume: 0.8, getOAuthToken: cb => { token().then(cb).catch(() => reject(new Error('auth'))); } });
      p.addListener('ready', ({ device_id }) => resolve(device_id));
      p.addListener('account_error', () => reject(new PremiumRequired('premium')));
      p.addListener('authentication_error', ({ message }) => reject(new Error(message)));
      p.addListener('initialization_error', ({ message }) => reject(new Error(message)));
      p.addListener('player_state_changed', s => { if (s) onState({ position: s.position / 1000, duration: s.duration / 1000, paused: s.paused }); });
      void p.connect();
      sdkPlayer = p;
    };
    loadScript('https://sdk.scdn.co/spotify-player.js').catch(reject);
  });
  sdkDevice.catch(() => { sdkPlayer?.disconnect(); sdkPlayer = null; });
  return sdkDevice;
}

export async function sdkPlay(uri: string, atSec: number) {
  void sdkPlayer?.activateElement(); // гар утсан дээр autoplay зөвшөөрүүлэх (хэрэглэгчийн үйлдлийн дотор)
  const device = await sdkDevice!;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${device}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${await token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ uris: [uri], position_ms: Math.round(atSec * 1000) }),
    });
    if (res.ok) return;
    if (res.status === 404 && attempt === 0) { await new Promise(r => setTimeout(r, 1000)); continue; } // төхөөрөмж бүртгэгдэж амжаагүй
    throw new Error('play ' + res.status);
  }
}
export const sdk = {
  pause: () => sdkPlayer?.pause(),
  resume: () => sdkPlayer?.resume(),
  seek: (sec: number) => sdkPlayer?.seek(Math.round(sec * 1000)),
};

/* ---------- 2) Embed (iFrame API) ---------- */
let embedCtl: Promise<SpotifyEmbedController> | null = null;

/** `host` элементийг Spotify embed-ээр солино. Энэ элемент DOM-д байнга байх ёстой. */
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
