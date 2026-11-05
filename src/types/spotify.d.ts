// Spotify Embed iFrame API-ийн ашиглаж буй хэсгийн төрөл
type SpotifyEmbedController = {
  loadUri(uri: string): void;
  play(): void;
  pause(): void;
  resume(): void;
  togglePlay(): void;
  seek(sec: number): void;
  destroy(): void;
  addListener(e: 'playback_update', cb: (e: { data: { position: number; duration: number; isPaused: boolean; isBuffering: boolean } }) => void): void;
  addListener(e: 'ready', cb: () => void): void;
};

interface Window {
  onSpotifyIframeApiReady?: (api: {
    createController(el: HTMLElement, opts: { uri: string; width?: number | string; height?: number }, cb: (c: SpotifyEmbedController) => void): void;
  }) => void;
}
