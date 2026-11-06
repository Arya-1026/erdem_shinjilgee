/* ---------- Сэтгэл хөдлөлийн түүх: шүүх, өдрөөр/сэтгэл хөдлөлөөр бүлэглэх ---------- */
import { MOODS } from './data';
import type { DayJournal, DayNote, Entry, MoodId } from './types';

export type HistoryFilter = { mood: MoodId | null; date: string; notesOnly: boolean };

const newestFirst = (a: Entry, b: Entry) => b.entry_date.localeCompare(a.entry_date) || b.entry_time.localeCompare(a.entry_time);

export const filterEntries = (entries: Entry[], f: HistoryFilter) =>
  entries.filter(e => (!f.mood || e.mood === f.mood) && (!f.date || e.entry_date === f.date) && (!f.notesOnly || e.note.trim())).sort(newestFirst);

export const filterJournals = (journals: DayJournal[], f: HistoryFilter) => journals.filter(j => (!f.mood || j.mood === f.mood) && (!f.date || j.day === f.date));
/** Нэмэлт тэмдэглэлд сэтгэл хөдлөл байхгүй тул сэтгэл хөдлөлөөр шүүхэд гарахгүй */
export const filterDayNotes = (notes: DayNote[], f: HistoryFilter) => (f.mood ? [] : notes.filter(n => !f.date || n.day === f.date));

/** Шинэ өдөр эхэндээ. Зөвхөн тэмдэглэлтэй өдөр ч орно. */
export function groupByDay(entries: Entry[], journals: DayJournal[] = [], notes: DayNote[] = []) {
  const days = [...new Set([...entries.map(e => e.entry_date), ...journals.map(j => j.day), ...notes.map(n => n.day)])].sort().reverse();
  return days.map(date => ({
    date, items: entries.filter(e => e.entry_date === date).sort(newestFirst),
    journal: journals.find(j => j.day === date), notes: notes.filter(n => n.day === date),
  }));
}

/** MOODS-ийн дарааллаар, бүртгэлгүй сэтгэл хөдлөлийг алгасна */
export function groupByMood(entries: Entry[], journals: DayJournal[] = []) {
  return MOODS.flatMap(m => {
    const items = entries.filter(e => e.mood === m.id).sort(newestFirst);
    const days = journals.filter(j => j.mood === m.id).sort((a, b) => b.day.localeCompare(a.day));
    return items.length || days.length ? [{ mood: m.id, items, journals: days }] : [];
  });
}

/** "2026-11-06" → [2026, 11, 6] */
export const dateParts = (date: string) => date.split('-').map(Number) as [number, number, number];
