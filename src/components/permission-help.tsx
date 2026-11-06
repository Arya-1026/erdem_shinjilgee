'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { browserHint, permissionState, requestPermission, watchPermission, type DeviceKind, type PermState } from '@/lib/permissions';

const ICON: Record<DeviceKind, string> = { microphone: '🎤', camera: '📷' };
const NAME: Record<DeviceKind, string> = { microphone: 'Микрофон', camera: 'Камер' };

/* Микрофон/камерын зөвшөөрөл: «Зөвшөөрөл өгөх» товч хөтчийн цонхыг шууд гаргана.
   Өмнө нь татгалзсан бол хөтөч дахин асуудаггүй тул хаягийн мөрөөс хэрхэн нээхийг алхам алхмаар зааж,
   зөвшөөрөгдмөгц автоматаар үргэлжилнэ. */
export function PermissionHelp({ kind, initial, onGranted, onCancel }: { kind: DeviceKind; initial?: PermState; onGranted: () => void; onCancel?: () => void }) {
  const tr = useT();
  const [state, setState] = useState<PermState | null>(initial ?? null);
  const [busy, setBusy] = useState(false);
  const hint = browserHint();
  const name = tr(NAME[kind]);

  useEffect(() => {
    let alive = true;
    if (!initial) void permissionState(kind).then(s => { if (alive) setState(s); });
    // Хэрэглэгч хөтчийн тохиргоонд зөвшөөрмөгц үргэлжлүүлнэ
    const stop = watchPermission(kind, s => { if (!alive) return; setState(s); if (s === 'granted') onGranted(); });
    return () => { alive = false; stop(); };
  }, [kind, initial, onGranted]);

  async function ask() {
    setBusy(true);
    const s = await requestPermission(kind);
    setBusy(false);
    setState(s);
    if (s === 'granted') onGranted();
  }

  async function recheck() {
    const s = await permissionState(kind);
    // Permissions API нь Safari дээр хуучирсан утга өгч болох тул шууд оролдож үзнэ
    if (s === 'granted') return onGranted();
    void ask();
  }

  if (state === 'unsupported') return (
    <div className="rounded-2xl border bg-background p-3.5 text-sm">
      <p>{tr('{0} олдсонгүй, эсвэл энэ хөтөч дэмжихгүй байна. Төхөөрөмжөө холбоод, Chrome/Safari-ийн шинэ хувилбар ашиглана уу.', name)}</p>
      {onCancel && <Button size="xl" variant="outline" className="mt-3 w-full" onClick={onCancel}>{tr('Хаах')}</Button>}
    </div>
  );

  return (
    <div className="rounded-2xl border bg-background p-3.5 text-sm">
      <div className="flex items-start gap-3">
        <span className="text-3xl" aria-hidden="true">{ICON[kind]}</span>
        <div className="min-w-0">
          <b className="block">{state === 'denied' ? tr('{0} ашиглах зөвшөөрөл хаалттай байна', name) : tr('{0} ашиглах зөвшөөрөл хэрэгтэй', name)}</b>
          <p className="mt-0.5 text-muted-foreground">
            {kind === 'microphone' ? tr('Дуугаар бичихэд микрофон хэрэгтэй. Бичлэг хадгалагдахгүй.') : tr('Зураг авахад камер хэрэгтэй. Зөвхөн таны авсан зураг хадгалагдана.')}
          </p>
        </div>
      </div>

      {state !== 'denied' ? (
        <Button size="xl" className="mt-3 w-full" disabled={busy || state === null} onClick={() => void ask()}>
          {busy ? tr('Хөтчийн цонхонд «Зөвшөөрөх» дарна уу…') : tr('{0} Зөвшөөрөл өгөх', ICON[kind])}
        </Button>
      ) : (
        <>
          <p className="mt-3 text-muted-foreground">{tr('Та өмнө нь татгалзсан тул хөтөч дахин асуухгүй. Вэб хуудас хөтчийн тохиргоог шууд нээж чадахгүй тул доорх алхмаар нээнэ үү:')}</p>
          <ol className="mt-2 grid list-decimal gap-1.5 pl-5">
            {hint === 'ios' ? <>
              <li>{tr('Safari-ийн хаягийн мөрөн дэх «аА» (эсвэл ⋯) товч дээр дарна')}</li>
              <li>{tr('«Вэбсайтын тохиргоо» (Website Settings) → {0} → «Зөвшөөрөх»', name)}</li>
              <li>{tr('Эсвэл: iPhone-ий Тохиргоо → Safari → {0} → «Зөвшөөрөх»', name)}</li>
            </> : hint === 'android' ? <>
              <li>{tr('Хаягийн мөрийн зүүн талын 🔒 (эсвэл ⓘ) дүрс дээр дарна')}</li>
              <li>{tr('«Зөвшөөрөл» (Permissions) → {0} → «Зөвшөөрөх»', name)}</li>
              <li>{tr('Хуудсыг дахин ачаална')}</li>
            </> : <>
              <li>{tr('Хаягийн мөрийн зүүн талын 🔒 (эсвэл ⓘ) дүрс дээр дарна')}</li>
              <li>{tr('{0} гэсэн мөрийг «Зөвшөөрөх» (Allow) болгоно', name)}</li>
              <li>{tr('Доорх «Дахин шалгах» товчийг дарна')}</li>
            </>}
          </ol>
          <Button size="xl" className="mt-3 w-full" onClick={() => void recheck()}>{tr('↻ Дахин шалгах')}</Button>
          <Button size="xl" variant="outline" className="mt-2 w-full" onClick={() => location.reload()}>{tr('Хуудсыг дахин ачаалах')}</Button>
        </>
      )}
      {onCancel && <Button size="xl" variant="ghost" className="mt-2 w-full" onClick={onCancel}>{tr('Болих')}</Button>}
    </div>
  );
}

/* Цонх хэлбэрээр (чатын жижиг 🎤 товч зэрэг байршил багатай газар) */
export function PermissionDialog({ kind, open, initial, onGranted, onClose }: { kind: DeviceKind; open: boolean; initial?: PermState; onGranted: () => void; onClose: () => void }) {
  const tr = useT();
  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogTitle className="pr-11 font-bold">{tr('{0} зөвшөөрөл', tr(NAME[kind]))}</DialogTitle>
        <DialogDescription className="sr-only">{tr('Хөтчийн зөвшөөрлийн тохиргоо')}</DialogDescription>
        {open && <PermissionHelp kind={kind} initial={initial} onGranted={onGranted} onCancel={onClose} />}
      </DialogContent>
    </Dialog>
  );
}
