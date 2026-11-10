import { afterEach, describe, expect, it, vi } from 'vitest';
import { dassPopupReady, offerDassAfterEntry, snoozeDass, visibleDassCard } from './dass-client';

// Node орчинд localStorage байхгүй тул энгийн санах ойн хувилбар
function fakeStorage() {
  const m = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) });
}

describe('Анхны бүртгэлийн дараах DASS-21 popup', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('анхны бүртгэл, асуулга бөглөөгүй бол санал болгоно', () => {
    fakeStorage();
    expect(offerDassAfterEntry(0, 0)).toBe(true);
  });

  it('өмнө бүртгэлтэй, аль хэдийн бөглөсөн, эсвэл тоо мэдэгдэхгүй бол санал болгохгүй', () => {
    fakeStorage();
    expect(offerDassAfterEntry(1, 0)).toBe(false);
    expect(offerDassAfterEntry(0, 1)).toBe(false);
    expect(offerDassAfterEntry(0, null)).toBe(false);
  });

  it('нүүрийн анхны асуулгын карт сэтгэл санаа бүртгэхээс өмнө нуугдана', () => {
    fakeStorage();
    expect(visibleDassCard('first', 0)).toBeNull();
    expect(visibleDassCard('first', 1)).toBe('first');
    // 14 хоногийн дахин бөглөх сануулга бүртгэлээс үл хамаарна
    expect(visibleDassCard('retake', 0)).toBe('retake');
    expect(visibleDassCard(null, 3)).toBeNull();
  });

  it('popup-аас хойшлуулбал нүүрийн карт тэр даруй нуугдана', () => {
    fakeStorage();
    expect(visibleDassCard('first', 1)).toBe('first');
    snoozeDass();
    expect(visibleDassCard('first', 1)).toBeNull();
  });

  it('popup-ийг «Бүртгэгдлээ» цонх хаагдаж, чат хаалттай үед л гаргана', () => {
    expect(dassPopupReady(true, false, false)).toBe(true);
    // «Бүртгэгдлээ» эсвэл амьсгалын дасгал зэрэг өөр цонх нээлттэй байна
    expect(dassPopupReady(true, true, false)).toBe(false);
    // «AI-тай ярилцах» сонгосон: чатаа хаах хүртэл хүлээнэ
    expect(dassPopupReady(true, false, true)).toBe(false);
    expect(dassPopupReady(false, false, false)).toBe(false);
  });

  it('«Дараа нь бөглөх» дарсан бол дахин гаргахгүй', () => {
    fakeStorage();
    snoozeDass();
    expect(offerDassAfterEntry(0, 0)).toBe(false);
  });
});
