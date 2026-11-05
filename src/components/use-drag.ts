'use client';

import { useCallback, useEffect, useRef } from 'react';

export type Offset = { x: number; y: number };
type Box = { left: number; top: number; right: number; bottom: number };

const MARGIN = 4;

/** Анхны байрлалаас хэр шилжиж болохыг дэлгэцийн хүрээнд багтаана. box: шилжүүлээгүй үеийн байрлал */
export function clampOffset(o: Offset, box: Box, width: number, height: number, left = 0, top = 0, margin = MARGIN): Offset {
  const fit = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
  return { x: fit(o.x, left + margin - box.left, width - margin - box.right), y: fit(o.y, top + margin - box.top, height - margin - box.bottom) };
}

const CORNER_GAP = 10;
const inArea = (o: Offset, box: Box, a: Box) => clampOffset(o, box, a.right, a.bottom, a.left, a.top, CORNER_GAP);

/** Элементийн төв аль талд байгаагаар хамгийн ойрын буланг сонгоно. cur: одоогийн шилжилт */
export function nearestCorner(cur: Offset, box: Box, area: Box): Offset {
  const cx = (box.left + box.right) / 2 + cur.x, cy = (box.top + box.bottom) / 2 + cur.y;
  return inArea({ x: cx < (area.left + area.right) / 2 ? -1e5 : 1e5, y: cy < (area.top + area.bottom) / 2 ? -1e5 : 1e5 }, box, area);
}

/** Цэс, толгой хэсэг, тоглуулагчийг дарахгүй үлдэх хэсэг */
function safeArea(): Box {
  const a = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
  const rect = (s: string) => document.querySelector(s)?.getBoundingClientRect();
  const nav = rect('.app-nav');
  if (nav) { if (nav.width > nav.height) a.bottom = nav.top; else a.left = nav.right; } // Утсан дээр доор, том дэлгэцэд зүүн талд
  const head = rect('.topbar');
  if (head) a.top = head.bottom;
  for (const s of ['.mini', '.embed-bar:not(.embed-off)']) {
    const r = rect(s);
    if (r?.height && r.bottom > a.bottom - 40) a.bottom = Math.min(a.bottom, r.top);
  }
  return a;
}

const KEY = 'setgel_drag_pos';
const load = (): Record<string, Offset> => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; }
};

/* Хөвөгч элементийг чирч зөөх. Байрлал нь горим (mode) тус бүрт хадгалагдана. Бариулаас (handle) л чирнэ,
   учир нь iframe дээрх дарах үйлдэл хуудсанд хүрдэггүй. */
export function useDrag(mode: string, active: boolean, snap: 'edges' | 'corners' = 'edges') {
  const el = useRef<HTMLDivElement | null>(null);
  const attach = useCallback((n: HTMLDivElement | null) => { el.current = n; }, []);
  const pos = useRef<Record<string, Offset> | null>(null);
  const drag = useRef<{ px: number; py: number; o: Offset; box: Box; vx: number; vy: number; lx: number; ly: number; lt: number } | null>(null);

  // transform-гүй үеийн байрлал
  const base = useCallback(() => {
    const r = el.current!.getBoundingClientRect(), o = new DOMMatrixReadOnly(getComputedStyle(el.current!).transform);
    return { left: r.left - o.e, top: r.top - o.f, right: r.right - o.e, bottom: r.bottom - o.f };
  }, []);
  const put = useCallback((o: Offset) => { el.current!.style.transform = `translate(${o.x}px, ${o.y}px)`; }, []);

  useEffect(() => {
    if (!active || !el.current) return;
    pos.current ??= load();
    const place = () => {
      const b = base(), saved = pos.current![mode] ?? { x: 0, y: 0 };
      const o = snap === 'corners' ? nearestCorner(saved, b, safeArea()) : clampOffset(saved, b, innerWidth, innerHeight);
      pos.current![mode] = o;
      put(o);
    };
    place();
    addEventListener('resize', place);
    // Тоглуулагч гарч ирэх, алга болоход чөлөөт хэсэг өөрчлөгдөнө
    const watch = new MutationObserver(place);
    if (snap === 'corners') watch.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => { removeEventListener('resize', place); watch.disconnect(); };
  }, [mode, active, snap, base, put]);

  const handle = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0 || !el.current) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      el.current.style.transition = 'none';
      drag.current = { px: e.clientX, py: e.clientY, o: pos.current?.[mode] ?? { x: 0, y: 0 }, box: base(), vx: 0, vy: 0, lx: e.clientX, ly: e.clientY, lt: e.timeStamp };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      // Сүүлийн хөдөлгөөний хурд (px/сек): тавихад хаашаа «шидсэнийг» тооцно
      const dt = (e.timeStamp - d.lt) / 1000;
      if (dt > 0) { d.vx = 0.6 * d.vx + 0.4 * ((e.clientX - d.lx) / dt); d.vy = 0.6 * d.vy + 0.4 * ((e.clientY - d.ly) / dt); }
      d.lx = e.clientX; d.ly = e.clientY; d.lt = e.timeStamp;
      const next = { x: d.o.x + e.clientX - d.px, y: d.o.y + e.clientY - d.py };
      const o = snap === 'corners' ? inArea(next, d.box, safeArea()) : clampOffset(next, d.box, innerWidth, innerHeight);
      (pos.current ??= {})[mode] = o;
      put(o);
    },
    onPointerUp: (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d || !el.current) return;
      drag.current = null;
      // iPhone-ийн PiP шиг: хурдыг нь нэмж тооцоод зүүн эсвэл баруун ирмэг рүү гулсаж наалдана.
      // Удаан тавьсан бол (100мс+) шидээгүй гэж үзнэ.
      const still = e.timeStamp - d.lt > 100;
      const vx = still ? 0 : d.vx, vy = still ? 0 : d.vy;
      const cur = pos.current?.[mode] ?? d.o;
      const w = d.box.right - d.box.left;
      const centre = d.box.left + cur.x + vx * 0.18 + w / 2;
      // Чат: дөрвөн булангийн аль нэгэнд л наалдана. Тоглуулагч: зүүн, баруун ирмэгийн дурын өндөрт.
      const o = snap === 'corners'
        ? nearestCorner({ x: cur.x + vx * 0.18, y: cur.y + vy * 0.18 }, d.box, safeArea())
        : clampOffset({ x: centre < innerWidth / 2 ? -1e5 : 1e5, y: cur.y + vy * 0.18 }, d.box, innerWidth, innerHeight);
      (pos.current ??= {})[mode] = o;
      el.current.style.transition = 'transform .38s cubic-bezier(.2, .9, .3, 1.12)';
      put(o);
      try { localStorage.setItem(KEY, JSON.stringify(pos.current)); } catch { /* хувийн горим */ }
    },
  };
  return [attach, { ...handle, onPointerCancel: handle.onPointerUp }] as const;
}
