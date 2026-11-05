'use client';

import { useRouter } from 'next/navigation';
import { createContext, use, useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, LOCALE_FLAGS, LOCALE_NAMES, LOCALES, translator, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** picked: хэрэглэгч энэ төхөөрөмж дээр хэлээ сонгосон эсэх */
type LocaleCtx = { locale: Locale; picked: boolean; setLocale: (l: Locale) => void };
const Ctx = createContext<LocaleCtx>({ locale: DEFAULT_LOCALE, picked: true, setLocale: () => {} });

export const useLocale = () => use(Ctx);
/** Орчуулах функц: tr('Хадгалах'), tr('{0} дуу', n) */
export const useT = () => translator(useLocale().locale);

/** Хэлийг cookie-д хадгална. Хэрэглэгч хэлээ сонгоогүй бол (chosen=false) эхлээд сонгуулна. */
export function LocaleProvider({ initial, chosen, children }: { initial: Locale; chosen: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const [locale, setState] = useState(initial);
  const [picked, setPicked] = useState(chosen);
  const [, startTransition] = useTransition();

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    if (!isLocale(l)) return;
    document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    setState(l);
    setPicked(true);
    // Server Component-ийн бичвэр шинэ хэлээр дахин ирнэ
    startTransition(() => router.refresh());
  }, [router]);

  const value = useMemo(() => ({ locale, picked, setLocale }), [locale, picked, setLocale]);
  // Хуудас ард нь хэвээр рендер хийгдэнэ: Next.js-ийн instant navigation шалгалт хуудсыг алгасахгүй
  return <Ctx value={value}>{children}{!picked && <LanguageGate />}</Ctx>;
}

/* Анх орж ирэхэд хэл сонгох дэлгэц. Хэл мэдэгдээгүй тул бичвэр хоёр хэлээр. */
function LanguageGate() {
  const { setLocale } = useLocale();
  return (
    <div role="dialog" aria-modal="true" aria-label="Хэлээ сонгоно уу / Choose your language" className="fixed inset-0 z-100 grid place-items-center overflow-y-auto bg-background px-4 py-8">
      <div className="card-x w-full max-w-[420px] text-center">
        <div className="text-5xl" aria-hidden="true">🌙</div>
        <h1 className="mt-3 text-[22px] leading-[30px] font-bold">Хэлээ сонгоно уу</h1>
        <p className="mb-5 text-muted-foreground">Choose your language</p>
        <LanguageButtons onPick={setLocale} />
        <p className="mt-4 text-xs text-muted-foreground">Дараа нь Профайл хэсгээс сольж болно · You can change this later in Profile</p>
      </div>
    </div>
  );
}

export function LanguageButtons({ value, onPick }: { value?: Locale; onPick: (l: Locale) => void }) {
  return (
    <div className="flex flex-col gap-2.5">
      {LOCALES.map(l => (
        <button key={l} type="button" aria-pressed={value === l} onClick={() => onPick(l)}
          className={cn('flex min-h-14 items-center gap-3 rounded-2xl border-[1.5px] bg-card px-4 text-left font-semibold transition-colors hover:border-primary', value === l && 'border-primary bg-secondary')}>
          <span className="text-2xl" aria-hidden="true">{LOCALE_FLAGS[l]}</span>
          <span lang={l}>{LOCALE_NAMES[l]}</span>
        </button>
      ))}
    </div>
  );
}

/* Хэл солих жижиг цэс (нэвтрэх хуудас). Сонголт шууд cookie-д хадгалагдана. */
export function LanguageSwitch({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  return (
    <label className={cn('inline-flex min-h-10 items-center gap-1.5 text-sm', className)}>
      <span aria-hidden="true">🌐</span>
      <span className="sr-only">Language / Хэл</span>
      <select value={locale} onChange={e => { if (isLocale(e.target.value)) setLocale(e.target.value); }} className="cursor-pointer rounded-lg bg-transparent py-1 font-semibold focus:outline-none">
        {LOCALES.map(l => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
      </select>
    </label>
  );
}
