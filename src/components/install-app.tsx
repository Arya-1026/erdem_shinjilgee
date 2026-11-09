'use client';

import Image from 'next/image';
import { useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/providers/locale-provider';
import { cn } from '@/lib/utils';

/* Аппыг утасны нүүр дэлгэцэнд суулгах (PWA).
   Android Chrome, Edge, desktop Chrome: браузер `beforeinstallprompt` өгвөл «Суулгах» товч шууд суулгана.
   iPhone/iPad: Apple ийм товч зөвшөөрдөггүй тул «Хуваалцах → Нүүр дэлгэцэнд нэмэх» зааврыг харуулна.
   Бусад браузер: цэснээс суулгах заавар. Аль хэдийн суулгасан (standalone) бол юу ч харуулахгүй. */

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
export type InstallState = 'installed' | 'prompt' | 'ios' | 'manual';

let deferred: PromptEvent | null = null;
let installed = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach(f => f());

if (typeof window !== 'undefined') {
  // Браузер энэ үйл явдлыг хуудас ачаалагдмагц нэг л удаа өгдөг тул модуль ачаалагдахад барьж авна
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as PromptEvent; emit(); });
  window.addEventListener('appinstalled', () => { deferred = null; installed = true; emit(); });
}

const isStandalone = () => installed || matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

function get(): InstallState {
  if (isStandalone()) return 'installed';
  if (deferred) return 'prompt';
  return isIOS() ? 'ios' : 'manual';
}

/** Сервер дээр 'installed' буцааж юу ч зурахгүй (hydration зөрөхгүй) */
export const useInstall = () => useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f); }, get, () => 'installed' as InstallState);

export async function promptInstall() {
  const e = deferred;
  if (!e) return false;
  deferred = null;
  await e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome === 'accepted') installed = true;
  emit();
  return outcome === 'accepted';
}

/** Суулгах товч эсвэл тухайн төхөөрөмжийн заавар */
export function InstallHelp({ state, className }: { state: InstallState; className?: string }) {
  const tr = useT();
  if (state === 'prompt') return <Button size="sm" className={className} onClick={() => void promptInstall()}>{tr('📲 Суулгах')}</Button>;
  if (state === 'ios') return <p className={cn('text-sm', className)}>{tr('Safari-ийн доод хэсгийн Хуваалцах ⬆️ товчийг дараад «Нүүр дэлгэцэнд нэмэх»-ийг сонгоно уу.')}</p>;
  if (state === 'manual') return <p className={cn('text-sm', className)}>{tr('Браузерын ⋮ цэснээс «Апп суулгах» эсвэл «Нүүр дэлгэцэнд нэмэх»-ийг сонгоно уу.')}</p>;
  return null;
}

const KEY = 'setgel-install-banner-hidden';
const hidden = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };

/** Утсан дээр нэг удаа гарах санал. Хаавал дахин гарахгүй (Профайлаас суулгаж болно). */
export function InstallBanner() {
  const tr = useT();
  const state = useInstall();
  const phone = useSyncExternalStore(() => () => {}, () => matchMedia('(pointer: coarse)').matches, () => false);
  const [closed, setClosed] = useState(false);
  if (state === 'installed' || !phone || closed || hidden()) return null;
  const close = () => { try { localStorage.setItem(KEY, '1'); } catch { /* хувийн цонх */ } setClosed(true); };
  return (
    <div role="region" aria-label={tr('Апп суулгах')} className="mx-4 mt-3 flex items-start gap-3 rounded-2xl border bg-card p-3.5 shadow-sm desk:mx-8">
      <Image src="/icons/icon-192.png" alt="" width={44} height={44} className="size-11 flex-none rounded-xl" />
      <div className="min-w-0 flex-1">
        <b>{tr('Сэтгэлийг утсандаа апп болгон суулгаарай')}</b>
        <p className="text-sm text-muted-foreground">{tr('Нүүр дэлгэцээс шууд нээгдэж, мэдэгдэл авна.')}</p>
        <InstallHelp state={state} className="mt-2" />
      </div>
      <button type="button" onClick={close} aria-label={tr('Хаах')} className="grid size-8 flex-none place-items-center rounded-full text-muted-foreground hover:bg-secondary">✕</button>
    </div>
  );
}
