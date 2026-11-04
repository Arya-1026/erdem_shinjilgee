// YouTube IFrame Player API-ийн ашиглаж буй хэсгийн төрөл
declare namespace YT {
  type Event = { target: Player; data: number };
  class Player {
    constructor(el: HTMLElement | string, opts: {
      width?: number | string; height?: number | string; videoId?: string;
      playerVars?: Record<string, string | number>;
      events?: { onReady?: (e: Event) => void; onStateChange?: (e: Event) => void; onError?: (e: Event) => void };
    });
    loadVideoById(o: { videoId: string; startSeconds?: number }): void;
    playVideo(): void;
    pauseVideo(): void;
    seekTo(sec: number, allowSeekAhead: boolean): void;
    getCurrentTime(): number;
    getDuration(): number;
  }
}

interface Window {
  YT: typeof YT;
  onYouTubeIframeAPIReady?: () => void;
}
