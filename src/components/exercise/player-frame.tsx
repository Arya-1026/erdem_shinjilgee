'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/* claude.ai дээр бүтээсэн дасгалын тоглуулагчид (public/players/*.html): алхалт, энергитэй дасгал, талархлын тэмдэглэл.
   Тус бүр өөрийн анимаци, синк хийсэн ая (Web Audio)-тай. Ижил домэйнээс iframe-ээр харуулж:
   - өөрийн гарчиг, хаах товчийг нууж, апп-ын өнгийг (гэрэлтэй/харанхуй) дамжуулна;
   - өндрийг агуулгад нь тааруулна;
   - дуусахад (finish / show(3)) onComplete, «Хаах»-д (closeAll) onClose дуудна.
   iframe хаагдахад хуудас нь устаж, ая хамт зогсоно. */
// Алхалт, энергитэй дасгал 3D дүрээр (ExerciseCoach) явна. Талархлын тэмдэглэл бичих талбартай тул энд үлдсэн.
export const PLAYERS: Record<string, string> = { e5: '/players/gratitude.html' };

const EMBED_CSS = `
html,body{background:transparent!important}
body{display:block!important;min-height:0!important;padding:0!important}
.modal{width:100%!important;background:transparent!important;box-shadow:none!important;padding:0!important;border-radius:0!important}
.modal>h2,.modal>.sub,.x{display:none!important}`;

/** Тоглуулагчийн товч, явцын мөр, тэмдэглэгээг апп-ын сонгосон өнгө, гэрэлтэй/харанхуй горимоор будна.
   color-scheme-ийг эх хуудастай тааруулахгүй бол хөтөч iframe-ийн ард цагаан дэвсгэр зурж, харанхуй горимд
   цайвар бичиг цагаан дээр уншигдахгүй болдог. */
function themeCss() {
  const root = getComputedStyle(document.documentElement);
  const v = (n: string) => root.getPropertyValue(n).trim();
  const dark = document.documentElement.classList.contains('dark');
  const [fg, muted, card, bg, border] = [v('--foreground'), v('--muted-foreground'), v('--card'), v('--background'), v('--border')];
  const [primary, pfg, secondary, sfg] = [v('--primary'), v('--primary-foreground'), v('--secondary'), v('--secondary-foreground')];
  const grad = v('--grad') || primary;
  return `${EMBED_CSS}
:root{color-scheme:${dark ? 'dark' : 'light'}!important;--text:${fg};--muted:${muted};--panel:${secondary};--track:${secondary};--field:${dark ? card : bg};--modal:transparent;--bg:transparent}
body{color:${fg}!important;font-family:${getComputedStyle(document.body).fontFamily}!important}
.btn,.main,button.next{background:${grad}!important;color:${pfg}!important}
.skip,.sq,.back{background:${secondary}!important;color:${sfg}!important}
.bar i,.dots i.on{background:${grad}!important}
.dots i{background:${border}!important}
.pill{background:${grad}!important;color:${pfg}!important}
.pill.rest{background:${secondary}!important;color:${sfg}!important}
.badge{background:color-mix(in srgb,${card} 88%,transparent)!important;color:${fg}!important}
li.now{background:color-mix(in srgb,${primary} 16%,transparent)!important;color:${primary}!important}
li.done::before{color:${primary}!important}
.done:not(li){color:${primary}!important}
.row.ok b{background:${primary}!important;color:${pfg}!important}
.pen{background:${secondary}!important}
input[type=range]{accent-color:${primary}!important}
input:not([type=range]),textarea{border-color:${border}!important}
input:focus,textarea:focus{border-color:${primary}!important}
input::placeholder,textarea::placeholder{color:${muted}!important}`;
}

type PlayerWin = Window & { finish?: () => void; show?: (s: number) => void; closeAll?: () => void; __setgel?: boolean };

export function PlayerFrame({ src, title, onComplete, onClose, className }: { src: string; title: string; onComplete: () => void; onClose: () => void; className?: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(640);
  const cb = useRef({ onComplete, onClose });
  useEffect(() => { cb.current = { onComplete, onClose }; });

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    let ro: ResizeObserver | undefined, mo: MutationObserver | undefined;
    const setup = () => {
      const w = el.contentWindow as PlayerWin | null, doc = el.contentDocument;
      if (!w || !doc || doc.location.href === 'about:blank' || w.__setgel) return;
      w.__setgel = true;
      // Апп-ын өнгийг тоглуулагчид дамжуулна. Цонх нээлттэй байхад өнгө, горим солигдвол шууд шинэчилнэ.
      const st = doc.createElement('style');
      st.textContent = themeCss();
      doc.head.appendChild(st);
      mo = new MutationObserver(() => { st.textContent = themeCss(); });
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
      mo.observe(document.head, { childList: true, subtree: true, characterData: true });
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
    return () => { el.removeEventListener('load', setup); ro?.disconnect(); mo?.disconnect(); };
  }, [src]);

  return <iframe ref={frame} src={src} title={title} style={{ height }} className={cn('mt-3 block w-full border-0', className)} />;
}
