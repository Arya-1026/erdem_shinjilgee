'use client';

import { useEffect, useMemo, useState } from 'react';
import { today } from '@/lib/date';
import { recommendMovies, type Movie } from '@/lib/movies';
import type { MoodId, ScoredRec } from '@/lib/types';
import { useApp } from './providers/app-provider';

// Каталог (~150KB) нэг удаа татагдаж, хуудас хооронд дахин татахгүй
let loading: Promise<Movie[]> | null = null;
let catalog: Movie[] | null = null;
const load = () => (loading ??= fetch('/movies.json').then(r => (r.ok ? r.json() : [])).then((c: Movie[]) => (catalog = c)).catch(() => (catalog = [])));

// Сүүлд санал болгосон кинонууд: «Дэлгэрэнгүй» цонх эндээс шалтгаантай нь уншина
const shown = new Map<string, ScoredRec>();
export const shownMovie = (id: string) => shown.get(id);

/**
 * Тухайн хүнд, тухайн mood-д тохирох IMDb-ийн өндөр үнэлгээтэй кинонууд (ачаалж байх үед null).
 * refresh: одоо харагдаж байгааг хасаад дараагийн тохирох кинонуудыг гаргана. Тохирох кино дуусвал эхнээсээ.
 */
export function useMovieRecs(mood: MoodId, n = 12) {
  const { profile, feedback } = useApp();
  const [cat, setCat] = useState(catalog);
  const [seen, setSeen] = useState<{ mood: MoodId; ids: string[] }>({ mood, ids: [] });
  useEffect(() => { if (!catalog) void load().then(setCat); }, []);
  const day = today();
  const exclude = useMemo(() => (seen.mood === mood ? seen.ids : []), [seen, mood]);
  const recs = useMemo(() => {
    if (!cat) return null;
    const t = { mood, hobbies: profile.hobbies, birthYear: profile.birth_year, feedback, seed: day + exclude.length };
    const next = recommendMovies(cat, { ...t, exclude }, n);
    return next.length >= n / 2 ? next : recommendMovies(cat, t, n);
  }, [cat, mood, profile.hobbies, profile.birth_year, feedback, day, n, exclude]);
  useEffect(() => { recs?.forEach(r => shown.set(r.id, r)); }, [recs]);
  const refresh = () => setSeen(s => {
    const ids = [...(s.mood === mood ? s.ids : []), ...(recs ?? []).map(r => r.id)];
    // Бүгдийг үзээд дуусвал эхнээс нь
    return { mood, ids: recs && recs.some(r => exclude.includes(r.id)) ? [] : ids };
  });
  return { recs, refresh };
}
