'use client';

import { useRef } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { squareThumb } from './mood-images';
import { useApp } from './providers/app-provider';

/** Профайл зураг, байхгүй бол нэрийн эхний үсэг */
export function Avatar({ className }: { className?: string }) {
  const { profile } = useApp();
  return (
    <span className={cn('grid flex-none place-items-center overflow-hidden rounded-full bg-[linear-gradient(135deg,var(--primary),var(--primary-2))] font-bold text-white', className)}>
      {profile.avatar
        // eslint-disable-next-line @next/next/no-img-element -- data URL, next/image оновчлох шаардлагагүй
        ? <img src={profile.avatar} alt="" className="size-full object-cover" />
        : profile.name[0] || '?'}
    </span>
  );
}

/* Профайл хуудас: зураг дээр дарж солих, хасах */
export function AvatarEditor() {
  const { profile, updateProfile } = useApp();
  const input = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return void toast.error('Зөвхөн зураг сонгоно уу');
    try {
      await updateProfile({ avatar: await squareThumb(file, 256) });
      toast('Профайл зураг солигдлоо ✓');
    } catch {
      toast.error('Зургийг уншиж чадсангүй');
    }
  }

  return (
    <div className="flex flex-none flex-col items-center gap-1">
      <input ref={input} type="file" accept="image/*" className="hidden" aria-label="Профайл зураг сонгох" onChange={e => void onFile(e)} />
      <button type="button" className="group relative rounded-full" aria-label="Профайл зураг солих" onClick={() => input.current?.click()}>
        <Avatar className="size-16 text-2xl" />
        <span className="absolute -right-0.5 -bottom-0.5 grid size-6 place-items-center rounded-full border-2 border-card bg-primary text-xs text-primary-foreground" aria-hidden="true">📷</span>
      </button>
      {profile.avatar && <button type="button" className="min-h-6 text-xs text-primary" onClick={() => void updateProfile({ avatar: null })}>Хасах</button>}
    </div>
  );
}
