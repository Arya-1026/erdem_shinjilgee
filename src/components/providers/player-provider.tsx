'use client';

import { createContext, use, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { toast } from 'sonner';
import { hashStr, startMusic, stopMusic } from '@/lib/music';
import { embed, embedPlay, initSdk, PremiumRequired, sdk, sdkPlay, type SpState } from '@/lib/spotify-playback';
import { cn } from '@/lib/utils';
import { yt, YT_STATE, ytPlay } from '@/lib/youtube-playback';
import type { MoodId } from '@/lib/types';
import { useDrag } from '../use-drag';
import { useApp } from './app-provider';

/* =========================================================
   ТОГЛУУЛАГЧ: хуудас солиход тасрахгүй ((app) layout дотор нэг удаа mount хийгддэг).
   Дуу бүр 3 эх үүсвэрийн нэгээс тоглоно:
   - synth:   хөгжмийн эх үүсвэр холбоогүй үед mood-ийн аялгууг браузер дээр үүсгэнэ (демо)
   - youtube: YouTube IFrame Player (үнэгүй, бүтэн дуу, харагдах "dock" дотор)
   - spotify: Premium → Web Playback SDK, бусад → Spotify Embed
   ========================================================= */
export type Track = {
  id: string; title: string; artist: string; mood: MoodId; dur: number;
  source: 'synth' | 'spotify' | 'youtube'; uri?: string; videoId?: string; image?: string | null;
};

export const mkTrack = (id: string, title: string, artist: string, mood: MoodId): Track =>
  ({ id, title, artist, mood, dur: 150 + (hashStr(title, 3) % 90), source: 'synth' });

export type SpotifyRow = { track_id: string; name: string; artists: string; uri: string; duration_ms: number; image: string | null };
export const spTrack = (r: SpotifyRow, mood: MoodId, id = 'sp:' + r.track_id): Track =>
  ({ id, title: r.name, artist: r.artists, mood, dur: r.duration_ms / 1000, source: 'spotify', uri: r.uri, image: r.image });

export type YouTubeRow = { video_id: string; title: string; artist: string; thumbnail: string | null; duration_s: number };
export const ytTrack = (r: YouTubeRow, mood: MoodId): Track =>
  ({ id: 'yt:' + r.video_id, title: r.title, artist: r.artist, mood, dur: r.duration_s, source: 'youtube', videoId: r.video_id, image: r.thumbnail });

type SpMode = 'sdk' | 'embed';

type PlayerCtx = {
  queue: Track[];
  idx: number;
  current: Track | undefined;
  playing: boolean;
  full: boolean;
  nowId: string | undefined;
  /** Spotify Embed эсвэл YouTube тоглуулагч харагдаж байгаа бол mini player нуугдана */
  usesEmbed: boolean;
  /** YouTube тоглуулагчийг mini bar болгон хураасан (видео түр зогссон) */
  ytMin: boolean;
  setYtMin: (b: boolean) => void;
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

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useApp();
  const [queue, setQueue] = useState<Track[]>([]);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [full, setFull] = useState(false);
  const [ytMin, setYtMinState] = useState(false);
  const [spMode, setSpMode] = useState<SpMode>(() => (typeof localStorage !== 'undefined' && localStorage.getItem(MODE_KEY) === 'embed' ? 'embed' : 'sdk'));

  const live = useRef({ queue, idx, playing, spMode });
  useEffect(() => { live.current = { queue, idx, playing, spMode }; });
  const synth = useRef({ pos: 0, t0: 0 });
  const sp = useRef<SpState & { at: number }>({ position: 0, duration: 0, paused: true, at: 0 });
  const startedAt = useRef(0);
  const ytErrors = useRef(0);
  const embedWrap = useRef<HTMLDivElement>(null), embedHost = useRef<HTMLDivElement | null>(null);
  const ytWrap = useRef<HTMLDivElement>(null), ytHost = useRef<HTMLDivElement | null>(null);

  const cur = useCallback(() => live.current.queue[live.current.idx], []);
  const elapsed = useCallback(() => {
    const t = cur();
    if (t?.source === 'youtube') return yt.time();
    if (t?.source === 'spotify') { const s = sp.current; return s.paused ? s.position : s.position + (performance.now() - s.at) / 1000; }
    return live.current.playing ? (performance.now() - synth.current.t0) / 1000 : synth.current.pos;
  }, [cur]);
  const duration = useCallback(() => {
    const t = cur();
    if (t?.source === 'youtube') return yt.duration() || t.dur;
    return t?.source === 'spotify' && sp.current.duration > 0 ? sp.current.duration : t?.dur ?? 0;
  }, [cur]);

  // Гадны тоглуулагчийн (Spotify/YouTube) эвентүүд. Engine-үүд функцийг нэг удаа авдаг тул ref-ээр дамжуулна.
  const onSpRef = useRef<(s: SpState) => void>(() => {});
  const onSpState = useCallback((s: SpState) => onSpRef.current(s), []);
  const onYtRef = useRef<{ onState: (s: number) => void; onError: (code: number) => void }>({ onState: () => {}, onError: () => {} });
  const ytHandlers = useMemo(() => ({ onState: (s: number) => onYtRef.current.onState(s), onError: (c: number) => onYtRef.current.onError(c) }), []);

  // Embed/YouTube API нь элементийг iframe-ээр солидог тул React-ийн удирддаггүй элемент үүсгэнэ
  const hostIn = useCallback((wrap: React.RefObject<HTMLDivElement | null>, host: React.RefObject<HTMLDivElement | null>) => {
    if (!host.current && wrap.current) { host.current = document.createElement('div'); wrap.current.appendChild(host.current); }
    return host.current!;
  }, []);

  const pauseExternal = useCallback((t: Track | undefined) => {
    if (t?.source === 'youtube') yt.pause();
    else if (t?.source === 'spotify') { if (live.current.spMode === 'sdk') sdk.pause(); else embed.pause(); }
  }, []);

  const playSpotify = useCallback((t: Track, at: number) => {
    sp.current = { position: at, duration: t.dur, paused: false, at: performance.now() };
    const viaEmbed = () => embedPlay(hostIn(embedWrap, embedHost), t.uri!, at, onSpState).catch(() => toast.error('Spotify тоглуулагч ачаалагдсангүй'));
    if (live.current.spMode === 'embed') return void viaEmbed();
    initSdk(onSpState).then(() => sdkPlay(t.uri!, at)).catch(e => {
      // Premium биш эсвэл браузер SDK дэмжихгүй → Embed руу шилжиж, дараа нь шууд Embed ашиглана
      localStorage.setItem(MODE_KEY, 'embed');
      live.current.spMode = 'embed';
      setSpMode('embed');
      if (e instanceof PremiumRequired) toast('Spotify Premium биш тул Spotify embed-ээр тоглуулж байна');
      void viaEmbed();
    });
  }, [onSpState, hostIn]);

  const startAt = useCallback((q: Track[], i: number, at: number) => {
    const t = q[i]; if (!t) return;
    const prev = cur();
    if (prev && prev.source !== t.source) pauseExternal(prev);
    startedAt.current = performance.now();
    if (t.source === 'synth') {
      startMusic(t.mood, t.title, at);
      synth.current = { pos: at, t0: performance.now() - at * 1000 };
    } else {
      stopMusic();
      if (t.source === 'spotify') playSpotify(t, at);
      if (t.source === 'youtube') void ytPlay(hostIn(ytWrap, ytHost), t.videoId!, at, ytHandlers).catch(() => toast.error('YouTube тоглуулагч ачаалагдсангүй'));
    }
    live.current = { ...live.current, queue: q, idx: i, playing: true };
    setQueue(q); setIdx(i); setPlaying(true);
  }, [cur, pauseExternal, playSpotify, hostIn, ytHandlers]);

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
    if (t.source === 'youtube') yt.resume();
    else { sp.current = { ...sp.current, paused: false, at: performance.now() }; if (live.current.spMode === 'sdk') sdk.resume(); else embed.resume(); }
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
    if (t.source === 'youtube') yt.seek(sec);
    else if (t.source === 'spotify') {
      sp.current = { ...sp.current, position: sec, at: performance.now() };
      if (live.current.spMode === 'sdk') sdk.seek(sec); else embed.seek(sec);
    } else if (live.current.playing) startAt(live.current.queue, live.current.idx, sec);
    else synth.current.pos = sec;
  }, [cur, startAt]);

  // Хураахад дуу үргэлжилнэ: видео буланд 200×200 болж багасна (YouTube-ийн дүрмээр тоглуулагч харагдаж байх ёстой)
  const setYtMin = useCallback((b: boolean) => { setYtMinState(b); }, []);

  const stop = useCallback(() => {
    stopMusic(); pauseExternal(cur());
    synth.current.pos = 0;
    live.current = { ...live.current, queue: [], idx: 0, playing: false };
    setQueue([]); setIdx(0); setPlaying(false); setFull(false); setYtMinState(false);
  }, [cur, pauseExternal]);

  // Гадны тоглуулагчийн өөрийн товчоор зогсоох/тоглуулахыг тусгана (эхлүүлсний дараах түр төлөвийг тооцохгүй)
  const syncPlaying = useCallback((isPlaying: boolean) => {
    if (performance.now() - startedAt.current > 1500 && isPlaying !== live.current.playing) { live.current.playing = isPlaying; setPlaying(isPlaying); }
  }, []);

  useEffect(() => {
    onSpRef.current = s => {
      const prev = sp.current;
      // Дуу дуусахад Spotify байрлалыг 0 болгож зогсоодог → дараагийнх руу шилжинэ
      const ended = !prev.paused && prev.duration > 0 && prev.position >= prev.duration - 3 && s.position < 1 && s.paused;
      sp.current = { ...s, at: performance.now() };
      if (ended) return skip(1);
      if (cur()?.source === 'spotify') syncPlaying(!s.paused);
    };
    onYtRef.current = {
      onState: s => {
        if (cur()?.source !== 'youtube') return;
        if (s === YT_STATE.ENDED) skip(1);
        else if (s === YT_STATE.PLAYING) { ytErrors.current = 0; syncPlaying(true); }
        else if (s === YT_STATE.PAUSED) syncPlaying(false);
      },
      // 101/150: эзэмшигч нь вэб сайтад суулгахыг хориглосон, 100: устсан бичлэг
      onError: () => {
        // Дараалал бүхэлдээ тоглохгүй бол мөнхөд эргэлдэхгүйн тулд зогсооно
        if (++ytErrors.current >= live.current.queue.length) { ytErrors.current = 0; toast.error('Эдгээр бичлэгийг апп дотор тоглуулах боломжгүй байна'); return stop(); }
        toast('Энэ бичлэгийг апп дотор тоглуулах боломжгүй тул дараагийнх руу шилжлээ');
        skip(1);
      },
    };
  }, [skip, cur, syncPlaying, stop]);

  // Демо аялгуу, Spotify дуу дуусахад дараагийнх руу шилжинэ (YouTube-ийнх ENDED эвентээр)
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => { const c = cur(), d = duration(); if (c?.source !== 'youtube' && d > 0 && elapsed() >= d - 0.3) skip(1); }, 500);
    return () => clearInterval(t);
  }, [playing, cur, elapsed, duration, skip]);

  // Spotify холбогдсон бол SDK-г урьдчилан ачаалж, Premium эсэхийг мэдэж авна
  useEffect(() => {
    if (!profile.spotify_connected || spMode !== 'sdk') return;
    initSdk(onSpState).catch(() => { localStorage.setItem(MODE_KEY, 'embed'); setSpMode('embed'); });
  }, [profile.spotify_connected, spMode, onSpState]);

  const current = queue[idx];
  const usesYt = current?.source === 'youtube';
  const usesSpEmbed = current?.source === 'spotify' && spMode === 'embed';

  // Доод цэсний дээр тоглуулагч гарахад хуудасны доод зайг нэмнэ
  useEffect(() => {
    document.body.classList.toggle('has-player', queue.length > 0);
    document.body.classList.toggle('has-yt', usesYt && !ytMin);
  }, [queue.length, usesYt, ytMin]);
  useEffect(() => () => { stopMusic(); document.body.classList.remove('has-player', 'has-yt'); }, []);

  const value = useMemo<PlayerCtx>(() => ({
    queue, idx, current, playing, full, nowId: current?.id, usesEmbed: usesYt || usesSpEmbed, ytMin, setYtMin, elapsed, duration, play, toggle, skip, jump, seek, setFull, stop,
  }), [queue, idx, current, playing, full, usesYt, usesSpEmbed, ytMin, setYtMin, elapsed, duration, play, toggle, skip, jump, seek, stop]);

  const ctrl = 'grid size-9 flex-none place-items-center rounded-full text-white';
  const [dockRef, grip] = useDrag(ytMin ? 'small' : 'full', usesYt);
  return (
    <Ctx value={value}>
      {children}
      {/* YouTube: Spotify маягийн нэг мөр. Видео нь YouTube-ийн дүрмээр ≥200×200, дээр нь юу ч давхарлахгүй */}
      <div ref={dockRef} className={cn('yt-dock fixed z-36 flex overflow-hidden rounded-2xl bg-[#121212] text-white shadow-[0_10px_30px_rgba(0,0,0,.35)]', !usesYt && 'yt-off', usesYt && ytMin && 'yt-small', full && 'z-56')}
        aria-hidden={!usesYt} role="region" aria-label="YouTube тоглуулагч">
        <div {...grip} className="yt-grip" title="Чирж зөөх" aria-hidden="true"><i /></div>
        <div ref={ytWrap} className="yt-frame" />
        {ytMin ? (
          <div className="flex items-center justify-between px-1.5 py-1">
            <button className={ctrl} aria-label={playing ? 'Түр зогсоох' : 'Тоглуулах'} onClick={toggle}>{playing ? '❚❚' : '▶'}</button>
            <button className={ctrl} aria-label="Дараах" onClick={() => skip(1)}>⏭</button>
            <button className={ctrl} aria-label="Дэлгэх" onClick={() => setYtMin(false)}>⌃</button>
            <button className={cn(ctrl, 'text-white/70')} aria-label="Хаах" onClick={stop}>✕</button>
          </div>
        ) : <div className="flex min-w-0 flex-1 flex-col justify-between p-3">
          <div className="flex items-start gap-1">
            <div className="min-w-0 flex-1">
              <b className="line-clamp-2 text-sm leading-snug">{usesYt ? current.title : ''}</b>
              <span className="mt-0.5 block truncate text-xs opacity-70">{usesYt ? current.artist : ''}</span>
            </div>
            <button className={cn(ctrl, '-mt-1 -mr-1 text-white/70')} aria-label="Хураах" title="Хураах (дуу үргэлжилнэ)" onClick={() => setYtMin(true)}>⌄</button>
          </div>
          <div className="flex items-center justify-between">
            <button className={ctrl} aria-label="Өмнөх" onClick={() => skip(-1)}>⏮</button>
            <button className={cn(ctrl, 'size-11 bg-white text-lg text-[#121212]')} aria-label={playing ? 'Түр зогсоох' : 'Тоглуулах'} onClick={toggle}>{playing ? '❚❚' : '▶'}</button>
            <button className={ctrl} aria-label="Дараах" onClick={() => skip(1)}>⏭</button>
          </div>
          <div className="flex items-center justify-between text-white/70">
            <button className={ctrl} aria-label="Дараалал" onClick={() => setFull(!full)}>☰</button>
            <button className={ctrl} aria-label="Хаах" onClick={stop}>✕</button>
          </div>
        </div>}
      </div>
      {/* Spotify Embed: DOM-д байнга байна (iframe дахин ачаалагдахгүй), шаардлагагүй үед дэлгэцээс гадна */}
      <div className={cn('embed-bar fixed z-36 flex items-center gap-1 rounded-2xl bg-[#121212] p-1 shadow-[0_10px_30px_rgba(0,0,0,.3)]', !usesSpEmbed && 'embed-off', full && 'z-56')}
        aria-hidden={!usesSpEmbed} role="region" aria-label="Spotify тоглуулагч">
        <div ref={embedWrap} className="h-20 min-w-0 flex-1 overflow-hidden rounded-xl" />
        <div className="flex flex-col">
          <button className="grid size-9 place-items-center text-white" aria-label="Дараах" onClick={() => skip(1)}>⏭</button>
          <button className="grid size-9 place-items-center text-white" aria-label="Дараалал" onClick={() => setFull(!full)}>☰</button>
        </div>
        <button className="grid size-9 place-items-center self-start text-white/70" aria-label="Хаах" onClick={stop}>✕</button>
      </div>
    </Ctx>
  );
}
