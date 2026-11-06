'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { MOODS, moodById } from '@/lib/data';
import type { MoodId } from '@/lib/types';
import { cn } from '@/lib/utils';
import { CameraCapture, squareFrom } from './camera-capture';
import { MoodFace } from './mood-face';
import { useApp } from './providers/app-provider';
import { Button } from './ui/button';
import { useT } from '@/components/providers/locale-provider';

const SIZE = 128;

/** Зургийг төвөөс нь дөрвөлжин тайрч size px болгоно: 128px нь өгөгдлийн санд ~10KB хадгалагдана */
export async function squareThumb(file: File, size = SIZE) {
  const bmp = await createImageBitmap(file);
  const url = squareFrom(bmp, bmp.width, bmp.height, size);
  bmp.close();
  return url;
}

/* Профайл: сэтгэл хөдлөл бүрийн дүрсийг өөрийн зургаар солих.
   Дүрс дээр дарахад: 🖼 төхөөрөмжөөс зураг сонгох, эсвэл 📷 камераар шууд авах (зөвшөөрлийг эндээс өгнө). */
export function MoodImages() {
  const tr = useT();
  const { profile, updateProfile } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [sel, setSel] = useState<MoodId | null>(null);
  const [camera, setCamera] = useState(false);
  const images = profile.mood_images ?? {};

  const close = () => { setSel(null); setCamera(false); };

  async function save(id: MoodId, url: string) {
    await updateProfile({ mood_images: { ...images, [id]: url } });
    toast(tr('«{0}» зураг солигдлоо ✓', tr(moodById(id).label)));
    close();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !sel) return;
    if (!file.type.startsWith('image/')) return void toast.error(tr('Зөвхөн зураг сонгоно уу'));
    try {
      await save(sel, await squareThumb(file));
    } catch {
      toast.error(tr('Зургийг уншиж чадсангүй'));
    }
  }

  const clear = (id: MoodId) => { void updateProfile({ mood_images: Object.fromEntries(Object.entries(images).filter(([k]) => k !== id)) }); close(); };
  const m = sel ? moodById(sel) : null;

  return (
    <div className="border-b py-3">
      <b>{tr('Сэтгэл хөдлөлийн зураг')}</b>
      <div className="mb-2.5 text-sm text-muted-foreground">{tr('Дүрс дээр дарж зураг оруулах эсвэл камераар шууд авна')}</div>
      <input ref={input} type="file" accept="image/*" className="hidden" aria-label={tr('Зураг сонгох')} onChange={e => void onFile(e)} />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
        {MOODS.map(x => (
          <div key={x.id} className="flex flex-col items-center gap-1 text-center text-xs">
            <button type="button" aria-expanded={sel === x.id} aria-label={tr('{0}: зураг солих', tr(x.label))}
              className={cn('grid size-14 place-items-center rounded-full border-2 border-dashed transition', sel === x.id && 'border-solid border-primary ring-3 ring-primary/25')}
              onClick={() => { setCamera(false); setSel(s => (s === x.id ? null : x.id)); }}>
              <MoodFace m={x} className="size-11 text-[2rem]" />
            </button>
            <span className="truncate">{tr(x.label)}</span>
          </div>
        ))}
      </div>

      {m && (
        <div className="fade-up mt-3 rounded-2xl border bg-background p-3">
          <div className="mb-3 flex items-center gap-3">
            <MoodFace m={m} className="size-12 flex-none text-[2.2rem]" />
            <b className="min-w-0 flex-1">{tr('«{0}» дүрсийг солих', tr(m.label))}</b>
          </div>
          {camera ? (
            <CameraCapture size={SIZE} onCapture={url => save(m.id, url)} onCancel={() => setCamera(false)} />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button size="xl" variant="secondary" onClick={() => input.current?.click()}>{tr('🖼 Зураг оруулах')}</Button>
              <Button size="xl" onClick={() => setCamera(true)}>{tr('📷 Камераар авах')}</Button>
              {images[m.id] && <Button size="xl" variant="outline" onClick={() => clear(m.id)}>{tr('Өөрийн зургийг хасах')}</Button>}
              <Button size="xl" variant="ghost" onClick={close}>{tr('Болих')}</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
