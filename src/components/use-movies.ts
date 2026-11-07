'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { today } from '@/lib/date';
import { recommendMovies, watchlistMovies, type Movie } from '@/lib/movies';
import type { MoodId, ScoredRec } from '@/lib/types';
import { useApp } from './providers/app-provider';

// Каталог (~600KB, gzip ~160KB) нэг удаа татагдаж, хуудас хооронд дахин татахгүй
let loading: Promise<Movie[]> | null = null;
let catalog: Movie[] | null = null;
const load = () => (loading ??= fetch('/movies.json').then(r => (r.ok ? r.json() : [])).then((c: Movie[]) => (catalog = c)).catch(() => (catalog = [])));

function useCatalog() {
  const [cat, setCat] = useState(catalog);
  useEffect(() => { if (!catalog) void load().then(setCat); }, []);
  return cat;
}

// Сүүлд харуулсан кинонууд: «Дэлгэрэнгүй» цонх эндээс шалтгаантай нь уншина
const shown = new Map<string, ScoredRec>();
export const shownMovie = (id: string) => shown.get(id);

/* «✓ Үзсэн» кинонууд: энэ төхөөрөмж дээр хадгалагдаж, дахин санал болгогдохгүй */
const WATCHED_KEY = 'setgel_watched';
const listeners = new Set<() => void>();
let watchedCache: string[] | null = null;
const readWatched = (): string[] => {
  if (watchedCache) return watchedCache;
  try { watchedCache = JSON.parse(localStorage.getItem(WATCHED_KEY) ?? '[]'); } catch { watchedCache = []; }
  return watchedCache ?? [];
};
const EMPTY: string[] = [];
export function useWatched() {
  const watched = useSyncExternalStore(cb => { listeners.add(cb); return () => { listeners.delete(cb); }; }, readWatched, () => EMPTY);
  const markWatched = useCallback((id: string) => {
    watchedCache = [...readWatched().filter(x => x !== id), id].slice(-500);
    try { localStorage.setItem(WATCHED_KEY, JSON.stringify(watchedCache)); } catch { /* хувийн горим */ }
    listeners.forEach(l => l());
  }, []);
  return { watched, markWatched };
}

/**
 * Тухайн хүнд, тухайн mood-д тохирох IMDb-ийн өндөр үнэлгээтэй кинонууд (ачаалж байх үед null).
 * refresh: одоо харагдаж байгааг хасаад дараагийн тохирох кинонуудыг гаргана. Тохирох кино дуусвал эхнээсээ.
 */
export function useMovieRecs(mood: MoodId, n = 12) {
  const { profile, feedback, watchlist } = useApp();
  const { watched } = useWatched();
  const cat = useCatalog();
  const [seen, setSeen] = useState<{ mood: MoodId; ids: string[] }>({ mood, ids: [] });
  const day = today();
  const exclude = useMemo(() => [...(seen.mood === mood ? seen.ids : []), ...watched], [seen, mood, watched]);
  const recs = useMemo(() => {
    if (!cat) return null;
    const t = { mood, hobbies: profile.hobbies, birthYear: profile.birth_year, feedback, watchlist, seed: day + exclude.length };
    const next = recommendMovies(cat, { ...t, exclude }, n);
    return next.length >= n / 2 ? next : recommendMovies(cat, { ...t, exclude: watched }, n);
  }, [cat, mood, profile.hobbies, profile.birth_year, feedback, watchlist, watched, day, n, exclude]);
  useEffect(() => { recs?.forEach(r => shown.set(r.id, r)); }, [recs]);
  const refresh = () => setSeen(s => {
    const ids = [...(s.mood === mood ? s.ids : []), ...(recs ?? []).map(r => r.id)];
    // Бүгдийг үзээд дуусвал эхнээс нь
    return { mood, ids: recs && recs.some(r => exclude.includes(r.id)) ? [] : ids };
  });
  return { recs, refresh };
}

/** Үзэх жагсаалтад нэмсэн кинонууд (ачаалж байх үед null) */
export function useWatchlistMovies(mood: MoodId) {
  const { profile, feedback, watchlist } = useApp();
  const cat = useCatalog();
  const recs = useMemo(
    () => (cat ? watchlistMovies(cat, watchlist, { mood, hobbies: profile.hobbies, birthYear: profile.birth_year, feedback }) : null),
    [cat, watchlist, mood, profile.hobbies, profile.birth_year, feedback],
  );
  useEffect(() => { recs?.forEach(r => shown.set(r.id, r)); }, [recs]);
  return recs;
}
