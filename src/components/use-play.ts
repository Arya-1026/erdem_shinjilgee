'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { moodById } from '@/lib/data';
import type { MusicKind } from '@/lib/music-suggest';
import type { MoodId, SongRec } from '@/lib/types';
import { useApp } from './providers/app-provider';
import { songTrack, usePlayer, type Track } from './providers/player-provider';
import { useT } from '@/components/providers/locale-provider';

type RecsState = { recs: SongRec[] | null; loading: boolean; reason?: string };

/** Тухайн хүнд, тухайн mood-д зориулж AI-ийн санал болгосон дуунууд (сервер 7 хоног хадгална) */
export function useSongRecs(moodId: MoodId, kind: MusicKind = 'song') {
  const tr = useT();
  const { music } = useApp();
  const [state, setState] = useState<RecsState & { mood?: MoodId; kind?: MusicKind }>({ recs: null, loading: false });

  const load = useCallback(async (refresh: boolean) => {
    setState(s => ({ ...s, loading: true }));
    try {
      const res = await fetch(`/api/music/recs?mood=${moodId}&kind=${kind}${refresh ? '&refresh=1' : ''}`, { cache: 'no-store' });
      const j: { recs?: SongRec[]; reason?: string; cached?: boolean } = await res.json();
      setState({ mood: moodId, kind, recs: j.recs ?? [], loading: false, reason: j.reason });
      if (refresh && j.reason === 'quota') toast(tr('Spotify-ийн хайлтын хязгаарт хүрсэн тул одоо шинэчлэх боломжгүй.'));
      else if (refresh && j.cached) toast(tr('Саяхан шинэчилсэн байна. Түр хүлээгээд дахин оролдоорой.'));
    } catch {
      setState({ mood: moodId, kind, recs: [], loading: false, reason: 'error' });
    }
  }, [moodId, kind, tr]);

  // Carousel-аар mood-уудыг гүйлгэх үед хүсэлт бүрт дуу үүсгэхгүйн тулд түр хүлээнэ (Spotify хайлтын квот)
  useEffect(() => {
    if (!music.discovery) return;
    const t = setTimeout(() => void load(false), 600);
    return () => clearTimeout(t);
  }, [load, music.discovery]);
  // mood солиход хуучин mood-ийн дуу харагдахгүй
  const fresh = state.mood === moodId && state.kind === kind;
  // Дуу харагдмагц Spotify тоглуулагчийг урьдчилан ачаална: эхний товшилтоос дуу 10 гаруй биш 2-3 секундэд гарна
  const { prime } = usePlayer();
  const first = fresh ? state.recs?.[0]?.video_id : undefined;
  useEffect(() => { if (first) prime('spotify:track:' + first); }, [first, prime]);
  return { recs: music.discovery ? (fresh ? state.recs : null) : [], loading: state.loading || (music.discovery && !fresh), reason: state.reason, refresh: () => load(true) };
}

// Зөвлөмж, хэрэглэгчийн сангаас дараалал үүсгэж тоглуулах үйлдлүүд
export function usePlay() {
  const tr = useT();
  const { music, likedSongs } = useApp();
  const player = usePlayer();

  const toggleOr = (id: string, start: () => void) => (player.nowId === id ? player.toggle() : start());

  return {
    /** Жагсаалтаас (AI-ийн санал, таалагдсан дуу) дараалал үүсгэж i-р дууг тоглуулна */
    list(tracks: Track[], i: number) {
      toggleOr(tracks[i]?.id, () => player.play(tracks, i));
    },
    /** Тухайн mood-ийн playlist: түүнд зориулсан AI-ийн санал → (байхгүй бол) таалагдсан дуунууд */
    async mood(moodId: MoodId) {
      const m = moodById(moodId);
      const recs = await (music.discovery ? fetch(`/api/music/recs?mood=${moodId}`).then(r => r.json()).catch(() => null) as Promise<{ recs?: SongRec[] } | null> : null);
      const forYou = (recs?.recs ?? []).map(r => songTrack(r, moodId));
      const q = forYou.length ? forYou : likedSongs.map(r => songTrack(r, moodId));
      if (!q.length) return void toast(tr('Энэ мэдрэмжид тохирох дуу олдсонгүй'));
      player.play(q, 0);
      toast(tr('«{0}» үед танд зориулсан {1} дуу 🎧', tr(m.label), q.length));
    },
  };
}
