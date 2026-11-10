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

/** Нүүрийн картыг харуулах эсэх (render бүрт шалгана): анхны асуулгын картыг сэтгэл санаагаа бүртгэхээс өмнө
    харуулахгүй (анхны бүртгэлийн дараа popup гарна), popup-аас хойшлуулбал тэр даруй нуугдана */
export function visibleDassCard(kind: 'first' | 'retake' | null, entryCount: number): 'first' | 'retake' | null {
  if (!kind || snoozed()) return null;
  return kind === 'first' && entryCount === 0 ? null : kind;
}

/** Анхны сэтгэл санааны бүртгэлийн дараа DASS-21-ийг popup-аар санал болгох эсэх:
    өмнө бүртгэлгүй, асуулга огт бөглөөгүй (тоо мэдэгдэж байгаа), саяхан хойшлуулаагүй */
export function offerDassAfterEntry(prevEntries: number, dassCount: number | null): boolean {
  return prevEntries === 0 && dassCount === 0 && !snoozed();
}

/** Хүлээгдэж буй DASS-21 popup-ийг одоо гаргах эсэх: «Бүртгэгдлээ» цонх (болон түүнээс нээсэн амьсгалын дасгал г.м.)
    хаагдсан, AI чат хаалттай үед л гаргана. Ингэснээр хэрэглэгч эхлээд зөвлөмж, дуу зэргээ сонгож амжина. */
export function dassPopupReady(pending: boolean, dialogOpen: boolean, chatOpen: boolean): boolean {
  return pending && !dialogOpen && !chatOpen;
}
