'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useT } from '@/components/providers/locale-provider';
import { PermissionHelp } from '@/components/permission-help';
import { Button } from '@/components/ui/button';
import type { PermState } from '@/lib/permissions';
import { cn } from '@/lib/utils';

/** Эх сурвалжийн төвөөс дөрвөлжин тайрч size px JPEG болгоно (128px ≈ 10KB) */
export function squareFrom(src: CanvasImageSource, w: number, h: number, size: number, mirror = false) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  if (mirror) { g.translate(size, 0); g.scale(-1, 1); }
  const s = Math.min(w, h);
  g.drawImage(src, (w - s) / 2, (h - s) / 2, s, s, 0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.82);
}

type Phase = { kind: 'starting' } | { kind: 'live' } | { kind: 'perm'; state: PermState } | { kind: 'error'; msg: string };

/* 📷 Камераас шууд зураг авах. Нээгдмэгц хөтөч зөвшөөрөл асууна; татгалзсан бол нээх заавар харуулна,
   зөвшөөрөгдмөгц камер автоматаар асна. Авсан зургийг урьдчилж харуулаад «Хадгалах» дарахад onCapture дуудна. */
export function CameraCapture({ size = 128, onCapture, onCancel }: { size?: number; onCapture: (dataUrl: string) => void | Promise<void>; onCancel: () => void }) {
  const tr = useT();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'starting' });
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [many, setMany] = useState(false);
  const [shot, setShot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const stop = () => { stream.current?.getTracks().forEach(t => t.stop()); stream.current = null; };

  useEffect(() => {
    let alive = true;
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      queueMicrotask(() => setPhase({ kind: 'perm', state: 'unsupported' }));
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 960 }, height: { ideal: 960 } }, audio: false })
      .then(async s => {
        if (!alive) return s.getTracks().forEach(t => t.stop());
        stop();
        stream.current = s;
        if (video.current) { video.current.srcObject = s; await video.current.play().catch(() => {}); }
        setPhase({ kind: 'live' });
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        if (alive) setMany(devices.filter(d => d.kind === 'videoinput').length > 1);
      })
      .catch((e: DOMException) => {
        if (!alive) return;
        if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') setPhase({ kind: 'perm', state: 'denied' });
        else if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') setPhase({ kind: 'perm', state: 'unsupported' });
        else setPhase({ kind: 'error', msg: tr('Камер нээж чадсангүй. Өөр програм камер ашиглаж байгаа эсэхийг шалгана уу.') });
      });
    return () => { alive = false; stop(); };
  }, [facing, attempt, tr]);

  // Хөтчийн тохиргооноос зөвшөөрмөгц камерыг дахин асаана
  const retry = useCallback(() => { setPhase({ kind: 'starting' }); setAttempt(a => a + 1); }, []);

  function take() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    setShot(squareFrom(v, v.videoWidth, v.videoHeight, size, facing === 'user'));
  }

  async function save() {
    if (!shot) return;
    setBusy(true);
    await onCapture(shot);
    setBusy(false);
  }

  if (phase.kind === 'perm') return <PermissionHelp kind="camera" initial={phase.state} onGranted={retry} onCancel={onCancel} />;

  return (
    <div className="grid gap-3">
      <div className="relative mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-3xl bg-black">
        {/* Урд камерыг толь шиг харуулна, зураг ч мөн адил эргэнэ */}
        <video ref={video} playsInline muted autoPlay className={cn('size-full object-cover', facing === 'user' && '-scale-x-100', shot && 'invisible')} />
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL урьдчилсан харагдац */}
        {shot && <img src={shot} alt={tr('Авсан зураг')} className="absolute inset-0 size-full object-cover" />}
        {phase.kind === 'starting' && <p className="absolute inset-0 grid place-items-center text-sm text-white/80">{tr('Камер асааж байна… Хөтөч асуувал «Зөвшөөрөх» дарна уу')}</p>}
        {phase.kind === 'error' && <p className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-white">{phase.msg}</p>}
      </div>
      {shot ? (
        <div className="grid grid-cols-2 gap-2">
          <Button size="xl" variant="outline" disabled={busy} onClick={() => setShot(null)}>{tr('↻ Дахин авах')}</Button>
          <Button size="xl" disabled={busy} onClick={() => void save()}>{busy ? tr('Хадгалж байна…') : tr('✓ Хадгалах')}</Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="xl" variant="ghost" className="flex-none" onClick={onCancel}>{tr('Болих')}</Button>
          <Button size="xl" className="flex-1" disabled={phase.kind !== 'live'} onClick={take}>{tr('📸 Зураг авах')}</Button>
          {many && <Button size="xl" variant="outline" className="flex-none" aria-label={tr('Камер солих')} title={tr('Камер солих')}
            onClick={() => { setPhase({ kind: 'starting' }); setFacing(f => (f === 'user' ? 'environment' : 'user')); }}>🔄</Button>}
        </div>
      )}
    </div>
  );
}
