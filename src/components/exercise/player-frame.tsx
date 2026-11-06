'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/* claude.ai дээр бүтээсэн дасгалын тоглуулагчид (public/players/*.html): алхалт, энергитэй дасгал, талархлын тэмдэглэл.
   Тус бүр өөрийн анимаци, синк хийсэн ая (Web Audio)-тай. Ижил домэйнээс iframe-ээр харуулж:
   - өөрийн гарчиг, хаах товчийг нууж, апп-ын өнгийг (гэрэлтэй/харанхуй) дамжуулна;
   - өндрийг агуулгад нь тааруулна;
   - дуусахад (finish / show(3)) onComplete, «Хаах»-д (closeAll) onClose дуудна.
   iframe хаагдахад хуудас нь устаж, ая хамт зогсоно. */
export const PLAYERS: Record<string, string> = { e3: '/players/walk.html', e5: '/players/gratitude.html', e7: '/players/energy.html' };

const EMBED_CSS = `
html,body{background:transparent!important}
body{display:block!important;min-height:0!important;padding:0!important}
.modal{width:100%!important;background:transparent!important;box-shadow:none!important;padding:0!important;border-radius:0!important}
.modal>h2,.modal>.sub,.x{display:none!important}`;

type PlayerWin = Window & { finish?: () => void; show?: (s: number) => void; closeAll?: () => void; __setgel?: boolean };

export function PlayerFrame({ src, title, onComplete, onClose, className }: { src: string; title: string; onComplete: () => void; onClose: () => void; className?: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(640);
  const cb = useRef({ onComplete, onClose });
  useEffect(() => { cb.current = { onComplete, onClose }; });

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    let ro: ResizeObserver | undefined;
    const setup = () => {
      const w = el.contentWindow as PlayerWin | null, doc = el.contentDocument;
      if (!w || !doc || doc.location.href === 'about:blank' || w.__setgel) return;
      w.__setgel = true;
      // Апп-ын өнгийг тоглуулагчийн хувьсагчид дамжуулна
      const root = getComputedStyle(document.documentElement);
      const v = (n: string) => root.getPropertyValue(n).trim();
      const st = doc.createElement('style');
      st.textContent = `${EMBED_CSS}
:root{--text:${v('--foreground')};--muted:${v('--muted-foreground')};--panel:${v('--secondary')};--track:${v('--secondary')};--field:${v('--background')}}
body{font-family:${getComputedStyle(document.body).fontFamily}!important}`;
      doc.head.appendChild(st);
      // Дуусах, хаах үйлдлийг апп руу дамжуулна (дээд түвшний function нь window-ийн шинж чанар)
      let completed = false;
      const complete = () => { if (!completed) { completed = true; cb.current.onComplete(); } };
      const fin = w.finish, show = w.show, closeAll = w.closeAll;
      if (fin) w.finish = () => { fin(); complete(); };
      if (show) w.show = (s: number) => { show(s); if (s === 3) complete(); };
      if (closeAll && show) w.closeAll = () => { closeAll(); cb.current.onClose(); };
      // Өндрийг агуулгад тааруулна
      const fit = () => setHeight(Math.ceil(doc.documentElement.scrollHeight));
      ro = new ResizeObserver(fit); ro.observe(doc.body); fit();
    };
    el.addEventListener('load', setup);
    if (el.contentDocument?.readyState === 'complete') setup();
    return () => { el.removeEventListener('load', setup); ro?.disconnect(); };
  }, [src]);

  return <iframe ref={frame} src={src} title={title} style={{ height }} className={cn('mt-3 block w-full border-0', className)} />;
}
