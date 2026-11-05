'use client';

import { useTheme } from 'next-themes';
import { useEffect, useRef, useState } from 'react';
import type { MoodId } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useT } from '@/components/providers/locale-provider';

/* «Ботгоо» 3D дүр: public/botgo/botgo.html нь дуу хоолой нэмэхээс өмнөх хувилбар.
   iframe-ээр харуулж, window.Botgo.setMood-оор апп-ын mood-ыг, Botgo.translate-аар хэлний орчуулгыг дамжуулна.
   Зөвхөн хэрэгцээгүй хэсгүүдийг (тайлбар мөр, mood товчнууд) эцэг хуудаснаас нууна. */
const TO_BOTGO: Record<MoodId, string> = { happy: 'happy', calm: 'calm', neutral: 'bored', tired: 'tired', anxious: 'anxious', sad: 'sad', angry: 'angry' };
// canvas{touch-action:pan-y}: утсан дээр Ботгоо дээгүүр доош гүйлгэхэд хуудас гүйлгэгдэнэ (эргээд, хэлбэрээ хувиргахгүй). Хэвтээ чирвэл эргэнэ.
const EMBED_CSS = '.top,.hint,.moods{display:none!important} body{padding-inline:0!important} canvas{touch-action:pan-y!important}';

type BotgoWin = Window & { Botgo?: { setMood: (id: string) => void; translate?: (text: string) => string } };

export function Botgo3D({ mood, className }: { mood: MoodId; className?: string }) {
  const tr = useT();
  const frame = useRef<HTMLIFrameElement>(null);
  const { resolvedTheme } = useTheme();
  const [loaded, setLoaded] = useState(false);

  // three.js CDN-ээс ачаалагдаж Botgo бэлэн болтол хүлээгээд mood өгнө
  useEffect(() => {
    if (!loaded) return;
    let left = 40;
    const id = setInterval(() => {
      const w = frame.current?.contentWindow as BotgoWin | null | undefined;
      if (w?.Botgo) {
        // Хэл солигдоход ч энд ирж, Ботгоо шинэ хэлээр хэлнэ
        w.Botgo.translate = text => tr(text);
        w.document.getElementById('c')?.setAttribute('aria-label', tr('Ботгоо 3D дүр'));
        w.Botgo.setMood(TO_BOTGO[mood]);
        clearInterval(id);
      } else if (--left <= 0) clearInterval(id);
    }, 150);
    return () => clearInterval(id);
  }, [loaded, mood, tr]);

  // Апп-ын гэрэлтэй/харанхуй горимыг дагана (artifact data-theme-ийг дэмждэг)
  useEffect(() => {
    if (loaded && resolvedTheme) frame.current?.contentDocument?.documentElement.setAttribute('data-theme', resolvedTheme === 'dark' ? 'dark' : 'light');
  }, [loaded, resolvedTheme]);

  const onLoad = () => {
    const doc = frame.current?.contentDocument;
    if (!doc || doc.location.href === 'about:blank') return;
    if (!doc.getElementById('setgel-embed')) {
      const st = doc.createElement('style');
      st.id = 'setgel-embed';
      st.textContent = EMBED_CSS;
      doc.head.appendChild(st);
    }
    setLoaded(true);
  };

  // Хуудас React-аас өмнө ачаалагдаж дууссан бол onLoad дуудагдахгүй: тэр тохиолдолд шууд тохируулна
  useEffect(() => {
    if (frame.current?.contentDocument?.readyState === 'complete') onLoad();
  });

  return (
    <iframe ref={frame} src="/botgo/botgo.html" title={tr('Ботгоо 3D дүр')} onLoad={onLoad} loading="lazy"
      className={cn('block w-full rounded-2xl border-0', className)} />
  );
}
