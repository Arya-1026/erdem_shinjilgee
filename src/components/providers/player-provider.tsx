'use client';

import { createContext, use, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { toast } from 'sonner';
import { hashStr, startMusic, stopMusic } from '@/lib/music';
import { spotifyTrackUrl } from '@/lib/spotify-parse';
import { embed, embedPlay, initSdk, playsWithoutSdk, PremiumRequired, sdk, sdkPlay, type SpState } from '@/lib/spotify-playback';
import { yt, YT_STATE, ytPlay } from '@/lib/youtube-playback';
import { cn } from '@/lib/utils';
import type { MoodId } from '@/lib/types';
import { useApp } from './app-provider';
import { useT } from '@/components/providers/locale-provider';

/* =========================================================
   ТОГЛУУЛАГЧ: хуудас солиход тасрахгүй ((app) layout дотор нэг удаа mount хийгддэг).
   Дуу бүр 3 эх үүсвэрийн нэгээс тоглоно:
   - synth:   хөгжмийн эх үүсвэр холбоогүй үед mood-ийн аялгууг браузер дээр үүсгэнэ (демо)
   - spotify: Premium → Web Playback SDK, бусад → YouTube-ээр бүтэн, бичлэг олдохгүй бол Spotify Embed (preview)
   ========================================================= */
export type Track = {
  id: string; title: string; artist: string; mood: MoodId; dur: number;
  source: 'synth' | 'spotify'; uri?: string; image?: string | null;
};

export const mkTrack = (id: string, title: string, artist: string, mood: MoodId): Track =>
  ({ id, title, artist, mood, dur: 150 + (hashStr(title, 3) % 90), source: 'synth' });

export type SpotifyRow = { track_id: string; name: string; artists: string; uri: string; duration_ms: number; image: string | null };
export const spTrack = (r: SpotifyRow, mood: MoodId, id = 'sp:' + r.track_id): Track =>
  ({ id, title: r.name, artist: r.artists, mood, dur: r.duration_ms / 1000, source: 'spotify', uri: r.uri, image: r.image });

/** AI-ийн санал, таалагдсан дуу (video_id нь Spotify track id) */
export type SongRowLike = { video_id: string; title: string; artist: string; thumbnail: string | null; duration_s: number };
export const songTrack = (r: SongRowLike, mood: MoodId): Track =>
  ({ id: 'sp:' + r.video_id, title: r.title, artist: r.artist, mood, dur: r.duration_s, source: 'spotify', uri: 'spotify:track:' + r.video_id, image: r.thumbnail });

type PlayerCtx = {
  queue: Track[];
  idx: number;
  current: Track | undefined;
  playing: boolean;
  full: boolean;
  nowId: string | undefined;
  /** Spotify Embed эсвэл YouTube тоглуулагч харагдаж байгаа бол mini player нуугдана */
  usesEmbed: boolean;
  usesYt: boolean;
  elapsed: () => number;
  duration: () => number;
  play: (tracks: Track[], i: number) => void;
  toggle: () => void;
  skip: (d: number) => void;
  jump: (i: number) => void;
  seek: (sec: number) => void;
  setFull: (b: boolean) => void;
  stop: () => void;
};

const Ctx = createContext<PlayerCtx | null>(null);
export function usePlayer() {
  const c = use(Ctx);
  if (!c) throw new Error('usePlayer must be used within PlayerProvider');
  return c;
}

// Явцын мөрийг 4 удаа/сек шинэчлэх (зөвхөн тоглуулагчийн UI-д)
export function useTicker(active: boolean) {
  const [, tick] = useReducer((x: number) => x + 1, 0);
  useEffect(() => { if (!active) return; const t = setInterval(tick, 250); return () => clearInterval(t); }, [active]);
}

const MODE_KEY = 'setgel_sp_mode';

/** Spotify-ийн дууг яг одоо юугаар тоглуулж байгаа */
type Engine = 'sdk' | 'embed' | 'yt';
const ENGINES = { sdk, embed, yt };

/** Spotify-ийн дууны YouTube бичлэг. Сервер нийтэд хадгалдаг, энд хуудас дахин ачаалах хүртэл. */
const videoIds = new Map<string, string | null>();
async function lookupVideo(t: Track) {
  if (videoIds.has(t.id)) return videoIds.get(t.id)!;
  const res = await fetch(`/api/music/youtube?${new URLSearchParams({ artist: t.artist, title: t.title })}`);
  const { videoId = null }: { videoId?: string | null } = res.ok ? await res.json() : {};
  if (res.ok) videoIds.set(t.id, videoId);
  return videoId;
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const tr = useT();
  const { profile } = useApp();
  const [queue, setQueue] = useState<Track[]>([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [full, setFull] = useState(false);
  const [spMode, setSpMode] = useState<'sdk' | 'embed'>(() => (typeof localStorage !== 'undefined' && localStorage.getItem(MODE_KEY) === 'embed' ? 'embed' : 'sdk'));

  const live = useRef({ queue, idx, playing, spMode });
  useEffect(() => { live.current = { queue, idx, playing, spMode }; });
  const synth = useRef({ pos: 0, t0: 0 });
  const sp = useRef<SpState & { at: number }>({ position: 0, duration: 0, paused: true, at: 0 });
  const startedAt = useRef(0);
  const embedWrap = useRef<HTMLDivElement>(null), embedHost = useRef<HTMLDivElement | null>(null);
  const ytWrap = useRef<HTMLDivElement>(null), ytHost = useRef<HTMLDivElement | null>(null);
  const [engine, setEngineState] = useState<Engine | null>(null);
  const engineRef = useRef<Engine | null>(null);
  /** Хайлт дуусахаас өмнө өөр дуу сонговол хуучин хариуг тоглуулахгүй */
  const playGen = useRef(0);
  // Нэг удаа нэг л тоглуулагч дуугарна
  const setEngine = useCallback((e: Engine | null) => {
    const prev = engineRef.current;
    if (prev && prev !== e) ENGINES[prev].pause();
    engineRef.current = e;
    setEngineState(e);
  }, []);

  const connected = useRef(profile.spotify_connected);
  useEffect(() => { connected.current = profile.spotify_connected; }, [profile.spotify_connected]);
  const cur = useCallback(() => live.current.queue[live.current.idx], []);
  const elapsed = useCallback(() => {
    const t = cur();
    if (t?.source === 'spotify' && engineRef.current === 'yt') return yt.time();
    if (t?.source === 'spotify') { const s = sp.current; return s.paused ? s.position : s.position + (performance.now() - s.at) / 1000; }
    return live.current.playing ? (performance.now() - synth.current.t0) / 1000 : synth.current.pos;
  }, [cur]);
  const duration = useCallback(() => {
    const t = cur();
    if (t?.source === 'spotify' && engineRef.current === 'yt') return yt.duration() || t.dur;
    return t?.source === 'spotify' && sp.current.duration > 0 ? sp.current.duration : t?.dur ?? 0;
  }, [cur]);

  // Spotify тоглуулагчийн эвентүүд. Engine-үүд функцийг нэг удаа авдаг тул ref-ээр дамжуулна.
  const onSpRef = useRef<(s: SpState) => void>(() => {});
  const onSpState = useCallback((s: SpState) => onSpRef.current(s), []);
  const onYtRef = useRef<{ onState: (s: number) => void; onError: (code: number) => void }>({ onState: () => {}, onError: () => {} });
  const ytHandlers = useMemo(() => ({ onState: (s: number) => onYtRef.current.onState(s), onError: (c: number) => onYtRef.current.onError(c) }), []);

  // Embed API нь элементийг iframe-ээр солидог тул React-ийн удирддаггүй элемент үүсгэнэ
  const hostIn = useCallback((wrap: React.RefObject<HTMLDivElement | null>, host: React.RefObject<HTMLDivElement | null>) => {
    if (!host.current && wrap.current) { host.current = document.createElement('div'); wrap.current.appendChild(host.current); }
    return host.current!;
  }, []);

  const pauseExternal = useCallback((t: Track | undefined) => {
    if (t?.source === 'spotify' && engineRef.current) ENGINES[engineRef.current].pause();
  }, []);

  // Нөөц: Spotify-ийн 30 орчим секундын Preview. Embed тоглож эхэлснээ playback_update-ээр мэдэгдэнэ.
  const playPreview = useCallback((t: Track, at: number) => {
    setEngine('embed');
    sp.current = { position: at, duration: t.dur, paused: true, at: performance.now() };
    embedPlay(hostIn(embedWrap, embedHost), t.uri!, at, onSpState).catch(() => toast.error(tr('Spotify тоглуулагч ачаалагдсангүй')));
  }, [onSpState, hostIn, tr, setEngine]);

  // Premium-гүй үед YouTube-ээр бүтэн тоглуулна
  const playFree = useCallback(async (t: Track, at: number, gen: number) => {
    setEngine('yt');
    yt.pause();
    const videoId = await lookupVideo(t).catch(() => null);
    if (gen !== playGen.current) return;
    if (!videoId) return playPreview(t, at);
    ytPlay(hostIn(ytWrap, ytHost), videoId, at, ytHandlers).catch(() => { if (gen === playGen.current) playPreview(t, at); });
  }, [hostIn, ytHandlers, playPreview, setEngine]);

  const playSpotify = useCallback((t: Track, at: number) => {
    const gen = ++playGen.current;
    if (playsWithoutSdk(live.current.spMode, connected.current)) return void playFree(t, at, gen);
    setEngine('sdk');
    sp.current = { position: at, duration: t.dur, paused: false, at: performance.now() };
    initSdk(onSpState).then(() => sdkPlay(t.uri!, at)).catch(e => {
      // Premium биш эсвэл браузер SDK дэмжихгүй → дараа нь шууд YouTube ашиглана
      localStorage.setItem(MODE_KEY, 'embed');
      live.current.spMode = 'embed';
      setSpMode('embed');
      if (e instanceof PremiumRequired) toast(tr('Spotify Premium биш тул YouTube-ээр тоглуулж байна'));
      if (gen === playGen.current) void playFree(t, at, gen);
    });
  }, [onSpState, tr, playFree, setEngine]);

  const startAt = useCallback((q: Track[], i: number, at: number) => {
    const t = q[i]; if (!t) return;
    const prev = cur();
    if (prev && prev.source !== t.source) pauseExternal(prev);
    startedAt.current = performance.now();
    if (t.source === 'synth') {
      playGen.current++;
      setEngine(null);
      startMusic(t.mood, t.title, at);
      synth.current = { pos: at, t0: performance.now() - at * 1000 };
    } else {
      stopMusic();
      if (t.source === 'spotify') playSpotify(t, at);
    }
    live.current = { ...live.current, queue: q, idx: i, playing: true };
    setQueue(q); setIdx(i); setPlaying(true);
  }, [cur, pauseExternal, playSpotify, setEngine]);

  const play = useCallback((tracks: Track[], i: number) => { if (tracks.length) startAt(tracks, Math.max(0, i), 0); }, [startAt]);

  const toggle = useCallback(() => {
    const t = cur(); if (!t) return;
    if (live.current.playing) {
      if (t.source === 'spotify') sp.current = { ...sp.current, position: elapsed(), paused: true, at: performance.now() };
      if (t.source === 'synth') { synth.current.pos = elapsed(); stopMusic(); } else pauseExternal(t);
      live.current.playing = false; setPlaying(false);
      return;
    }
    if (t.source === 'synth') return startAt(live.current.queue, live.current.idx, synth.current.pos);
    startedAt.current = performance.now();
    sp.current = { ...sp.current, paused: false, at: performance.now() };
    if (engineRef.current) ENGINES[engineRef.current].resume();
    live.current.playing = true; setPlaying(true);
  }, [cur, elapsed, pauseExternal, startAt]);

  const skip = useCallback((d: number) => {
    const { queue: q, idx: i } = live.current; if (!q.length) return;
    if (d < 0 && elapsed() > 3) return startAt(q, i, 0);
    startAt(q, (i + d + q.length) % q.length, 0);
  }, [elapsed, startAt]);

  const jump = useCallback((i: number) => startAt(live.current.queue, i, 0), [startAt]);

  const seek = useCallback((sec: number) => {
    const t = cur(); if (!t) return;
    if (t.source === 'spotify') {
      sp.current = { ...sp.current, position: sec, at: performance.now() };
      if (engineRef.current) ENGINES[engineRef.current].seek(sec);
    } else if (live.current.playing) startAt(live.current.queue, live.current.idx, sec);
    else synth.current.pos = sec;
  }, [cur, startAt]);

  const stop = useCallback(() => {
    stopMusic(); pauseExternal(cur());
    playGen.current++;
    setEngine(null);
    synth.current.pos = 0;
    live.current = { ...live.current, queue: [], idx: 0, playing: false };
    setQueue([]); setIdx(0); setPlaying(false); setFull(false);
  }, [cur, pauseExternal, setEngine]);

  // Гадны тоглуулагчийн өөрийн товчоор зогсоох/тоглуулахыг тусгана (эхлүүлсний дараах түр төлөвийг тооцохгүй)
  const syncPlaying = useCallback((isPlaying: boolean) => {
    if (performance.now() - startedAt.current > 1500 && isPlaying !== live.current.playing) { live.current.playing = isPlaying; setPlaying(isPlaying); }
  }, []);

  useEffect(() => {
    onSpRef.current = s => {
      if (engineRef.current === 'yt') return;
      const prev = sp.current;
      // Дуу дуусахад Spotify байрлалыг 0 болгож зогсоодог → дараагийнх руу шилжинэ
      const ended = !prev.paused && prev.duration > 0 && prev.position >= prev.duration - 3 && s.position < 1 && s.paused;
      sp.current = { ...s, at: performance.now() };
      if (ended) return skip(1);
      if (cur()?.source === 'spotify') syncPlaying(!s.paused);
    };
  }, [skip, cur, syncPlaying]);

  useEffect(() => {
    onYtRef.current = {
      onState: s => {
        if (engineRef.current !== 'yt') return;
        if (s === YT_STATE.ENDED) skip(1);
        else if (s === YT_STATE.PLAYING) syncPlaying(true);
        else if (s === YT_STATE.PAUSED) syncPlaying(false);
      },
      // 100: устсан, 101/150: эзэмшигч нь вэб сайтад суулгахыг хориглосон → Spotify-ийн Preview
      onError: () => { const t = cur(); if (t && engineRef.current === 'yt') playPreview(t, 0); },
    };
  }, [skip, cur, syncPlaying, playPreview]);

  // Демо аялгуу, Spotify дуу дуусахад дараагийнх руу шилжинэ (YouTube-ийнх ENDED эвентээр)
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => { const c = cur(), d = duration(); if (c && engineRef.current !== 'yt' && d > 0 && elapsed() >= d - 0.3) skip(1); }, 500);
    return () => clearInterval(t);
  }, [playing, cur, elapsed, duration, skip]);

  // Spotify холбогдсон бол SDK-г урьдчилан ачаалж, Premium эсэхийг мэдэж авна
  useEffect(() => {
    if (!profile.spotify_connected || spMode !== 'sdk') return;
    initSdk(onSpState).catch(() => { localStorage.setItem(MODE_KEY, 'embed'); setSpMode('embed'); });
  }, [profile.spotify_connected, spMode, onSpState]);

  const current = queue[idx];
  // Embed-ийг дэлгэцээс гадна нуувал ачаалагдахгүй тул дуу гарахгүй: тоглох үед заавал харагдана
  const usesSpEmbed = current?.source === 'spotify' && engine === 'embed';
  const usesYt = current?.source === 'spotify' && engine === 'yt';
  const nowUrl = spotifyTrackUrl(current?.uri);

  // Доод цэсний дээр тоглуулагч гарахад хуудасны доод зайг нэмнэ
  useEffect(() => {
    document.body.classList.toggle('has-player', queue.length > 0);
    document.body.classList.toggle('has-yt', usesYt);
  }, [queue.length, usesYt]);
  useEffect(() => () => { stopMusic(); document.body.classList.remove('has-player', 'has-yt'); }, []);

  const value = useMemo<PlayerCtx>(() => ({
    queue, idx, current, playing, full, nowId: current?.id, usesEmbed: usesSpEmbed || usesYt, usesYt, elapsed, duration, play, toggle, skip, jump, seek, setFull, stop,
  }), [queue, idx, current, playing, full, usesSpEmbed, usesYt, elapsed, duration, play, toggle, skip, jump, seek, stop]);

  return (
    <Ctx value={value}>
      {children}
      {/* YouTube: дүрмээр тоглуулагч харагдаж, дор хаяж 200×200px, дээр нь юу ч давхарлахгүй */}
      <div className={cn('yt-dock fixed z-36 flex overflow-hidden rounded-2xl bg-[#121212] text-white shadow-[0_10px_30px_rgba(0,0,0,.35)]', !usesYt && 'yt-off', full && 'z-56')}
        aria-hidden={!usesYt} role="region" aria-label={tr('YouTube тоглуулагч')}>
        <div ref={ytWrap} className="yt-frame" />
        <div className="flex min-w-0 flex-1 flex-col justify-between p-2.5">
          <div className="min-w-0">
            <b className="line-clamp-2 text-sm leading-snug">{usesYt ? current.title : ''}</b>
            <span className="mt-0.5 block truncate text-xs opacity-70">{usesYt ? current.artist : ''}</span>
          </div>
          <div className="flex items-center justify-between">
            <button className="grid size-9 place-items-center" aria-label={tr('Өмнөх')} onClick={() => skip(-1)}>⏮</button>
            <button className="grid size-11 place-items-center rounded-full bg-white text-lg text-[#121212]" aria-label={playing ? tr('Түр зогсоох') : tr('Тоглуулах')} onClick={toggle}>{playing ? '❚❚' : '▶'}</button>
            <button className="grid size-9 place-items-center" aria-label={tr('Дараах')} onClick={() => skip(1)}>⏭</button>
          </div>
          <div className="flex items-center justify-between text-white/80">
            <button className="grid size-9 place-items-center" aria-label={tr('Дараалал')} onClick={() => setFull(!full)}>☰</button>
            {nowUrl && <a href={nowUrl} target="_blank" rel="noopener noreferrer" className="grid size-9 place-items-center" aria-label={tr('Spotify-д нээх ↗')} title={tr('Spotify-д нээх ↗')}>↗</a>}
            <button className="grid size-9 place-items-center" aria-label={tr('Хаах')} onClick={stop}>✕</button>
          </div>
        </div>
      </div>
      {/* Spotify Embed: DOM-д байнга байна (iframe дахин ачаалагдахгүй), шаардлагагүй үед дэлгэцээс гадна */}
      <div className={cn('embed-bar fixed z-36 flex items-center gap-1 rounded-2xl bg-[#121212] p-1 shadow-[0_10px_30px_rgba(0,0,0,.3)]', !usesSpEmbed && 'embed-off', full && 'z-56')}
        aria-hidden={!usesSpEmbed} role="region" aria-label={tr('Spotify тоглуулагч')}>
        <div ref={embedWrap} className="h-20 min-w-0 flex-1 overflow-hidden rounded-xl" />
        <div className="flex flex-col">
          <button className="grid size-9 place-items-center text-white" aria-label={tr('Дараах')} onClick={() => skip(1)}>⏭</button>
          <button className="grid size-9 place-items-center text-white" aria-label={tr('Дараалал')} onClick={() => setFull(!full)}>☰</button>
        </div>
        <div className="flex flex-col">
          <button className="grid size-9 place-items-center text-white/70" aria-label={tr('Хаах')} onClick={stop}>✕</button>
          {nowUrl && <a href={nowUrl} target="_blank" rel="noopener noreferrer" className="grid size-9 place-items-center text-white" aria-label={tr('Spotify-д бүтэн сонсох ↗')} title={tr('Spotify-д бүтэн сонсох ↗')}>↗</a>}
        </div>
      </div>
    </Ctx>
  );
}
