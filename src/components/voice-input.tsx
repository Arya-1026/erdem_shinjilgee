'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { useLocale, useT } from '@/components/providers/locale-provider';
import { PermissionDialog } from '@/components/permission-help';
import { permissionState, type PermState } from '@/lib/permissions';
import { cn } from '@/lib/utils';

/* 🎤 Дуугаар бичих: хөтчийн Web Speech API (түлхүүр, төлбөргүй).
   Chrome/Edge дээр ажилладаг (дууг Google танина). Дэмжихгүй хөтөч дээр товч харагдахгүй.
   Микрофон зөвхөн https эсвэл 127.0.0.1 дээр ажиллана. Бичлэг хадгалахгүй, зөвхөн текст нь талбарт орно. */

type Alt = { transcript: string };
type SRResult = { isFinal: boolean; 0: Alt };
type SREvent = { resultIndex: number; results: ArrayLike<SRResult> };
type SR = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: SREvent) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type SRCtor = new () => SR;

const getCtor = (): SRCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};
const INFO_KEY = 'setgel-voice-info';
const noop = () => () => {};

/** compact: зөвхөн 🎤 дүрс товч (чатын илгээх товчны хажууд). onInterim: ярьж байх үеийн түр текст (талбарт харуулахад). */
export function VoiceInput({ onText, onInterim, compact, className }: { onText: (text: string) => void; onInterim?: (text: string) => void; compact?: boolean; className?: string }) {
  const tr = useT();
  const { locale } = useLocale();
  const supported = useSyncExternalStore(noop, () => !!getCtor() && window.isSecureContext, () => false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const rec = useRef<SR | null>(null);
  // Микрофоны зөвшөөрөл байхгүй бол хөтчийн цонхыг гаргах / хаалттай бол нээх заавартай цонх
  const [perm, setPerm] = useState<PermState | null>(null);
  const cb = useRef(onText), cbInterim = useRef(onInterim);
  useEffect(() => { cb.current = onText; cbInterim.current = onInterim; });
  useEffect(() => () => rec.current?.abort(), []);
  const startRef = useRef<() => void>(() => {});
  // Зөвшөөрөл өгөгдмөгц цонхыг хааж, шууд сонсож эхэлнэ
  const onGranted = useCallback(() => { setPerm(null); startRef.current(); }, []);

  async function start() {
    const Ctor = getCtor();
    if (!Ctor) return;
    const p = await permissionState('microphone');
    // Зөвшөөрөөгүй бол: «Зөвшөөрөл өгөх» товч хөтчийн цонхыг шууд гаргана, хаалттай бол нээх заавар харуулна
    if (p !== 'granted') return void setPerm(p);
    listen(Ctor);
  }

  function listen(Ctor: SRCtor) {
    // Анх удаа: дуу Google-ийн сервер дээр танигдана гэдгийг мэдэгдэнэ
    try {
      if (!localStorage.getItem(INFO_KEY)) {
        toast(tr('🎤 Таны яриаг хөтөч (Google) танина. Бичлэг хадгалагдахгүй, зөвхөн текст нь талбарт орно.'), { duration: 6000 });
        localStorage.setItem(INFO_KEY, '1');
      }
    } catch { /* хувийн цонх */ }
    const r = new Ctor();
    r.lang = locale === 'en' ? 'en-US' : 'mn-MN';
    r.continuous = true;
    r.interimResults = true;
    r.onresult = e => {
      let fin = '', mid = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) fin += res[0].transcript; else mid += res[0].transcript;
      }
      if (fin.trim()) cb.current(fin.trim());
      setInterim(mid);
      cbInterim.current?.(mid);
    };
    r.onerror = e => {
      if (e.error === 'not-allowed') setPerm('denied');
      else if (e.error === 'service-not-allowed') toast.error(tr('Микрофон ашиглах зөвшөөрөл өгөөгүй байна. Хөтчийн тохиргооноос зөвшөөрнө үү.'));
      else if (e.error === 'language-not-supported') toast.error(tr('Энэ хөтөч монгол яриа танихгүй байна. Chrome ашиглаад үзээрэй.'));
      else if (e.error !== 'no-speech' && e.error !== 'aborted') toast.error(tr('Яриа танихад алдаа гарлаа'));
    };
    r.onend = () => { setListening(false); setInterim(''); cbInterim.current?.(''); rec.current = null; };
    rec.current = r;
    try { r.start(); setListening(true); } catch { setListening(false); }
  }
  const stop = () => rec.current?.stop();
  useEffect(() => { startRef.current = () => { const C = getCtor(); if (C) listen(C); }; });
  if (!supported) return null;
  const dialog = <PermissionDialog kind="microphone" open={perm !== null} initial={perm ?? undefined} onGranted={onGranted} onClose={() => setPerm(null)} />;

  if (compact) return (
    <>
    {dialog}
    <button type="button" onClick={listening ? stop : () => void start()} aria-pressed={listening}
      aria-label={listening ? tr('Дуугаар бичихийг зогсоох') : tr('Дуугаар бичих')} title={listening ? tr('Дуугаар бичихийг зогсоох') : tr('Дуугаар бичих')}
      className={cn('grid size-12 flex-none place-items-center rounded-xl border-[1.5px] text-xl transition-colors',
        listening ? 'animate-pulse border-red-500 bg-red-500/10' : 'bg-background hover:border-primary', className)}>
      <span aria-hidden="true">{listening ? '⏺' : '🎤'}</span>
    </button>
    </>
  );

  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      {dialog}
      <button type="button" onClick={listening ? stop : () => void start()} aria-pressed={listening}
        aria-label={listening ? tr('Дуугаар бичихийг зогсоох') : tr('Дуугаар бичих')}
        className={cn('flex h-9 flex-none items-center gap-1.5 rounded-full border-[1.5px] px-3 text-sm font-semibold transition-colors',
          listening ? 'border-red-500 bg-red-500/10 text-red-600 dark:text-red-300' : 'bg-background hover:border-primary')}>
        <span aria-hidden="true" className={cn(listening && 'animate-pulse')}>{listening ? '⏺' : '🎤'}</span>
        {listening ? tr('Сонсож байна… зогсоох') : tr('Дуугаар бичих')}
      </button>
      {listening && <span className="min-w-0 truncate text-sm text-muted-foreground italic" aria-live="polite">{interim || tr('Ярина уу…')}</span>}
    </div>
  );
}
