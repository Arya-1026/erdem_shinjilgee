'use client';

import { useRef } from 'react';
import { toast } from 'sonner';
import { MOODS } from '@/lib/data';
import type { MoodId } from '@/lib/types';
import { MoodFace } from './mood-face';
import { useApp } from './providers/app-provider';

const SIZE = 128;

/** Зургийг төвөөс нь дөрвөлжин тайрч 128px болгоно: өгөгдлийн санд ~10KB хадгалагдана */
async function squareThumb(file: File) {
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const s = Math.min(bmp.width, bmp.height);
  c.getContext('2d')!.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, SIZE, SIZE);
  bmp.close();
  return c.toDataURL('image/jpeg', 0.82);
}

/* Профайл: сэтгэл хөдлөл бүрийн дүрсийг өөрийн зургаар солих */
export function MoodImages() {
  const { profile, updateProfile } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const target = useRef<MoodId>('happy');
  const images = profile.mood_images ?? {};

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return void toast.error('Зөвхөн зураг сонгоно уу');
    try {
      await updateProfile({ mood_images: { ...images, [target.current]: await squareThumb(file) } });
    } catch {
      toast.error('Зургийг уншиж чадсангүй');
    }
  }

  const clear = (id: MoodId) => void updateProfile({ mood_images: Object.fromEntries(Object.entries(images).filter(([k]) => k !== id)) });

  return (
    <div className="border-b py-3">
      <b>Сэтгэл хөдлөлийн зураг</b>
      <div className="mb-2.5 text-sm text-muted-foreground">Дүрс дээр дарж өөрийн зургаар солино</div>
      <input ref={input} type="file" accept="image/*" className="hidden" aria-label="Зураг сонгох" onChange={e => void onFile(e)} />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-2">
        {MOODS.map(m => (
          <div key={m.id} className="flex flex-col items-center gap-1 text-center text-xs">
            <button type="button" className="grid size-14 place-items-center rounded-full border-2 border-dashed" aria-label={`${m.label}: зураг солих`}
              onClick={() => { target.current = m.id; input.current?.click(); }}>
              <MoodFace m={m} className="size-11 text-[2rem]" />
            </button>
            <span className="truncate">{m.label}</span>
            {images[m.id] && <button type="button" className="text-primary" aria-label={`${m.label}: зураг хасах`} onClick={() => clear(m.id)}>Хасах</button>}
          </div>
        ))}
      </div>
    </div>
  );
}
