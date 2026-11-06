/* DASS-21 сануулга (зөвхөн хөтөч дээр): «Дараа нь» дарсан бол хэдэн өдөр сануулахгүй */
import { DASS_RETAKE_DAYS } from './dass';

const SNOOZE_KEY = 'setgel-dass-snooze';
const SNOOZE_DAYS = 3;

export function snoozeDass() {
  try { localStorage.setItem(SNOOZE_KEY, String(Date.now())); } catch { /* хувийн цонх */ }
}

function snoozed() {
  try { return Date.now() - Number(localStorage.getItem(SNOOZE_KEY) ?? 0) < SNOOZE_DAYS * 864e5; } catch { return false; }
}

/** Нүүрт сануулах эсэх: огт бөглөөгүй эсвэл 14+ хоног өнгөрсөн, мөн саяхан хойшлуулаагүй */
export function dassReminder(lastAt: string | null): 'first' | 'retake' | null {
  if (snoozed()) return null;
  if (!lastAt) return 'first';
  return Date.now() - new Date(lastAt).getTime() >= DASS_RETAKE_DAYS * 864e5 ? 'retake' : null;
}
