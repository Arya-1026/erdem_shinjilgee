// Spotify Web Playback SDK болон Embed iFrame API-ийн ашиглаж буй хэсгийн төрөл
declare namespace Spotify {
  type PlaybackState = { position: number; duration: number; paused: boolean };
  type Err = { message: string };
  class Player {
    constructor(opts: { name: string; volume?: number; getOAuthToken: (cb: (token: string) => void) => void });
    connect(): Promise<boolean>;
    disconnect(): void;
    activateElement(): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    seek(ms: number): Promise<void>;
    addListener(e: 'ready' | 'not_ready', cb: (d: { device_id: string }) => void): boolean;
    addListener(e: 'player_state_changed', cb: (s: PlaybackState | null) => void): boolean;
    addListener(e: 'account_error' | 'authentication_error' | 'initialization_error' | 'playback_error', cb: (e: Err) => void): boolean;
  }
}

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
  Spotify: typeof Spotify;
  onSpotifyWebPlaybackSDKReady?: () => void;
  onSpotifyIframeApiReady?: (api: {
    createController(el: HTMLElement, opts: { uri: string; width?: number | string; height?: number }, cb: (c: SpotifyEmbedController) => void): void;
  }) => void;
}
