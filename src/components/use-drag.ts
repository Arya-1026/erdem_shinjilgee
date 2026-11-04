'use client';

import { useCallback, useEffect, useRef } from 'react';

export type Offset = { x: number; y: number };
type Box = { left: number; top: number; right: number; bottom: number };

const MARGIN = 4;

/** Анхны байрлалаас хэр шилжиж болохыг дэлгэцийн хүрээнд багтаана. box: шилжүүлээгүй үеийн байрлал */
export function clampOffset(o: Offset, box: Box, width: number, height: number): Offset {
  const fit = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));
  return { x: fit(o.x, MARGIN - box.left, width - MARGIN - box.right), y: fit(o.y, MARGIN - box.top, height - MARGIN - box.bottom) };
}

const KEY = 'setgel_yt_pos';
const load = (): Record<string, Offset> => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; }
};

/* Хөвөгч элементийг чирч зөөх. Байрлал нь горим (mode) тус бүрт хадгалагдана. Бариулаас (handle) л чирнэ,
   учир нь iframe дээрх дарах үйлдэл хуудсанд хүрдэггүй. */
export function useDrag(mode: string, active: boolean) {
  const el = useRef<HTMLDivElement | null>(null);
  const attach = useCallback((n: HTMLDivElement | null) => { el.current = n; }, []);
  const pos = useRef<Record<string, Offset> | null>(null);
  const drag = useRef<{ px: number; py: number; o: Offset; box: Box } | null>(null);

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
      const o = clampOffset(pos.current![mode] ?? { x: 0, y: 0 }, base(), innerWidth, innerHeight);
      pos.current![mode] = o;
      put(o);
    };
    place();
    addEventListener('resize', place);
    return () => removeEventListener('resize', place);
  }, [mode, active, base, put]);

  const handle = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0 || !el.current) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { px: e.clientX, py: e.clientY, o: pos.current?.[mode] ?? { x: 0, y: 0 }, box: base() };
    },
    onPointerMove: (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const o = clampOffset({ x: d.o.x + e.clientX - d.px, y: d.o.y + e.clientY - d.py }, d.box, innerWidth, innerHeight);
      (pos.current ??= {})[mode] = o;
      put(o);
    },
    onPointerUp: () => {
      if (!drag.current) return;
      drag.current = null;
      try { localStorage.setItem(KEY, JSON.stringify(pos.current)); } catch { /* хувийн горим */ }
    },
  };
  return [attach, { ...handle, onPointerCancel: handle.onPointerUp }] as const;
}
