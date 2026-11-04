'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { moodById } from '@/lib/data';
import { SPOTIFY_TRACK_COLS, YOUTUBE_TRACK_COLS } from '@/lib/db';
import { ytThumb } from '@/lib/mn-songs';
import { scoredRecs } from '@/lib/recs';
import type { MusicKind } from '@/lib/music-suggest';
import type { Mood, MoodId, SongRec, SpotifyTrackRow, YouTubeTrackRow } from '@/lib/types';
import { useApp } from './providers/app-provider';
import { mkTrack, spTrack, usePlayer, ytTrack, type Track } from './providers/player-provider';

const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

/** Хэрэглэгчийн Spotify сангаас тухайн mood-д тохирох дуунууд (холбоогүй бол хоосон) */
export function useSpotifyTracks(moodId: MoodId, limit = 30) {
  const { supabase, profile, libraryVersion } = useApp();
  const [tracks, setTracks] = useState<SpotifyTrackRow[] | null>(null);
  useEffect(() => {
    if (!profile.spotify_connected) return;
    let alive = true;
    supabase.from('spotify_tracks').select(SPOTIFY_TRACK_COLS).contains('moods', [moodId]).limit(300)
      .then(({ data }) => { if (alive) setTracks(shuffle((data as SpotifyTrackRow[]) ?? []).slice(0, limit)); });
    return () => { alive = false; };
  }, [supabase, profile.spotify_connected, moodId, limit, libraryVersion]);
  return profile.spotify_connected ? tracks : [];
}

/** Хэрэглэгчийн YouTube сангаас тухайн mood-д тохирох дуунууд */
export function useYouTubeTracks(moodId: MoodId, limit = 30) {
  const { supabase, profile, libraryVersion } = useApp();
  const [tracks, setTracks] = useState<YouTubeTrackRow[] | null>(null);
  useEffect(() => {
    if (!profile.youtube_connected) return;
    let alive = true;
    supabase.from('youtube_tracks').select(YOUTUBE_TRACK_COLS).contains('moods', [moodId]).limit(300)
      .then(({ data }) => { if (alive) setTracks(shuffle((data as YouTubeTrackRow[]) ?? []).slice(0, limit)); });
    return () => { alive = false; };
  }, [supabase, profile.youtube_connected, moodId, limit, libraryVersion]);
  return profile.youtube_connected ? tracks : [];
}

type RecsState = { recs: SongRec[] | null; loading: boolean; reason?: string };

/** Тухайн хүнд, тухайн mood-д зориулж AI-ийн санал болгосон дуунууд (сервер 7 хоног хадгална) */
export function useSongRecs(moodId: MoodId, kind: MusicKind = 'song') {
  const { music, libraryVersion } = useApp();
  const [state, setState] = useState<RecsState & { mood?: MoodId; kind?: MusicKind }>({ recs: null, loading: false });

  const load = useCallback(async (refresh: boolean) => {
    setState(s => ({ ...s, loading: true }));
    try {
      const res = await fetch(`/api/music/recs?mood=${moodId}&kind=${kind}${refresh ? '&refresh=1' : ''}`, { cache: 'no-store' });
      const j: { recs?: SongRec[]; reason?: string; cached?: boolean } = await res.json();
      setState({ mood: moodId, kind, recs: j.recs ?? [], loading: false, reason: j.reason });
      if (refresh && j.cached) toast('Саяхан шинэчилсэн байна. Түр хүлээгээд дахин оролдоорой.');
    } catch {
      setState({ mood: moodId, kind, recs: [], loading: false, reason: 'error' });
    }
  }, [moodId, kind]);

  // Carousel-аар mood-уудыг гүйлгэх үед хүсэлт бүрт дуу үүсгэхгүйн тулд түр хүлээнэ (YouTube хайлтын квот)
  useEffect(() => {
    if (!music.discovery) return;
    const t = setTimeout(() => void load(false), 600);
    return () => clearTimeout(t);
  }, [load, music.discovery, libraryVersion]);
  // mood солиход хуучин mood-ийн дуу харагдахгүй
  const fresh = state.mood === moodId && state.kind === kind;
  return { recs: music.discovery ? (fresh ? state.recs : null) : [], loading: state.loading || (music.discovery && !fresh), reason: state.reason, refresh: () => load(true) };
}

// Зөвлөмж, хэрэглэгчийн сангаас дараалал үүсгэж тоглуулах үйлдлүүд
export function usePlay() {
  const { supabase, profile, feedback, recTracks, music } = useApp();
  const player = usePlayer();

  // Апп-ын ерөнхий зөвлөмжийн дуу: Spotify холбосон бол жинхэнэ дуу, үгүй бол демо аялгуу
  const songsFor = (m: Mood) => scoredRecs(m, profile.hobbies, feedback).filter(r => r.type === 'song').map(r => {
    if (r.videoId) return { ...ytTrack({ video_id: r.videoId, title: r.title, artist: r.sub, thumbnail: ytThumb(r.videoId), duration_s: r.dur ?? 0 }, r.moods[0]), id: r.id };
    const sp = profile.spotify_connected ? recTracks[r.id] : undefined;
    return sp ? spTrack(sp, r.moods[0], r.id) : mkTrack(r.id, r.title, r.sub, r.moods[0]);
  });
  const toggleOr = (id: string, start: () => void) => (player.nowId === id ? player.toggle() : start());

  return {
    /** Апп-ын ерөнхий зөвлөмжийн дуу. Тоглож байгаа бол pause/resume */
    rec(id: string, mood: Mood) {
      toggleOr(id, () => { const q = songsFor(mood); player.play(q, q.findIndex(t => t.id === id)); });
    },
    /** Жагсаалтаас (хэрэглэгчийн сан, AI-ийн санал) дараалал үүсгэж i-р дууг тоглуулна */
    list(tracks: Track[], i: number) {
      toggleOr(tracks[i]?.id, () => player.play(tracks, i));
    },
    /** Тухайн mood-ийн playlist: хэрэглэгчийн өөрийн сан + түүнд зориулсан AI-ийн санал → (байхгүй бол) ерөнхий дуу */
    async mood(moodId: MoodId) {
      const m = moodById(moodId);
      const [yt, sp, recs] = await Promise.all([
        profile.youtube_connected ? supabase.from('youtube_tracks').select(YOUTUBE_TRACK_COLS).contains('moods', [moodId]).limit(300) : null,
        profile.spotify_connected ? supabase.from('spotify_tracks').select(SPOTIFY_TRACK_COLS).contains('moods', [moodId]).limit(300) : null,
        music.discovery ? fetch(`/api/music/recs?mood=${moodId}`).then(r => r.json()).catch(() => null) as Promise<{ recs?: SongRec[] } | null> : null,
      ]);
      const own = [
        ...shuffle((yt?.data as YouTubeTrackRow[] | undefined) ?? []).slice(0, 12).map(r => ytTrack(r, moodId)),
        ...shuffle((sp?.data as SpotifyTrackRow[] | undefined) ?? []).slice(0, 12).map(r => spTrack(r, moodId)),
      ];
      const forYou = (recs?.recs ?? []).map(r => ytTrack(r, moodId));
      // Өөрийн сан, AI-ийн санал хоёрыг ээлжлэн холино
      const mixed: Track[] = [];
      for (let i = 0; i < Math.max(own.length, forYou.length); i++) { if (own[i]) mixed.push(own[i]); if (forYou[i]) mixed.push(forYou[i]); }
      const q = mixed.length ? mixed : songsFor(m);
      if (!q.length) return void toast('Энэ мэдрэмжид тохирох дуу олдсонгүй');
      player.play(q, 0);
      toast(mixed.length ? `«${m.label}» үед танд зориулсан ${mixed.length} дуу 🎧` : `«${m.label}» playlist тоглож байна 🎧`);
    },
  };
}
