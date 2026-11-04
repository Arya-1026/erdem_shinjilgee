/* =========================================================
   YouTube IFrame Player (зөвхөн браузерт). Үнэгүй, бүтэн дуу тоглуулна.
   YouTube-ийн дүрэм: тоглуулагч харагдаж байх ёстой, хамгийн багадаа 200×200px,
   дээр нь юу ч давхарлаж болохгүй → PlayerProvider-ийн "dock"-д байрлана.
   ========================================================= */
export type YtHandlers = { onState: (state: number) => void; onError: (code: number) => void };

let apiReady: Promise<void> | null = null;
let player: YT.Player | null = null;
let playerReady: Promise<YT.Player> | null = null;

function loadApi() {
  if (apiReady) return apiReady;
  apiReady = new Promise(resolve => {
    if (window.YT?.Player) return resolve();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api'; s.async = true;
    document.body.appendChild(s);
  });
  return apiReady;
}

/** Анхны дуудлагаар `host` элементэд тоглуулагч үүсгэнэ, дараа нь зөвхөн бичлэг солино */
export async function ytPlay(host: HTMLElement, videoId: string, atSec: number, h: YtHandlers) {
  if (playerReady) {
    const p = await playerReady;
    p.loadVideoById({ videoId, startSeconds: atSec });
    return;
  }
  await loadApi();
  playerReady = new Promise(resolve => {
    player = new window.YT.Player(host, {
      width: '100%', height: '100%', videoId,
      playerVars: { autoplay: 1, playsinline: 1, rel: 0, start: Math.floor(atSec), origin: location.origin },
      events: {
        onReady: e => { e.target.playVideo(); resolve(e.target); },
        onStateChange: e => h.onState(e.data),
        onError: e => h.onError(e.data),
      },
    });
  });
  await playerReady;
}

export const yt = {
  pause: () => player?.pauseVideo?.(),
  resume: () => player?.playVideo?.(),
  seek: (sec: number) => player?.seekTo?.(sec, true),
  time: () => player?.getCurrentTime?.() ?? 0,
  duration: () => player?.getDuration?.() ?? 0,
};

/** YT.PlayerState */
export const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2 } as const;
