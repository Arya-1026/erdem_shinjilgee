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

/** Тухайн хүнд, тухайн mood-д тохирох IMDb-ийн өндөр үнэлгээтэй кинонууд. Ачаалж байх үед null. */
export function useMovieRecs(mood: MoodId, n = 12) {
  const { profile, feedback } = useApp();
  const [cat, setCat] = useState(catalog);
  useEffect(() => { if (!catalog) void load().then(setCat); }, []);
  const day = today();
  const recs = useMemo(
    () => (cat ? recommendMovies(cat, { mood, hobbies: profile.hobbies, birthYear: profile.birth_year, feedback, seed: day }, n) : null),
    [cat, mood, profile.hobbies, profile.birth_year, feedback, day, n],
  );
  useEffect(() => { recs?.forEach(r => shown.set(r.id, r)); }, [recs]);
  return recs;
}
