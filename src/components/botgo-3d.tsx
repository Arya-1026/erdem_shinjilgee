'use client';

import { useTheme } from 'next-themes';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { DEFAULT_PET, getPet, petById, PETS, setPet, subscribePet } from '@/lib/pets';
import type { MoodId } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useT } from '@/components/providers/locale-provider';

/* Хэрэглэгчийн сонгосон 3D амьтан (Ботгоо, Унагаа, Робо…). public/ доторх HTML-ийг iframe-ээр харуулж,
   setMood-оор апп-ын mood-ыг дамжуулна. Ботгоо window.Botgo (Botgo.translate-аар хэлний орчуулгатай), бусад нь window.Character API-тай.
   Зөвхөн хэрэгцээгүй хэсгүүдийг (тайлбар мөр, mood товчнууд) эцэг хуудаснаас нууна. */
const TO_PET: Record<MoodId, string> = { happy: 'happy', calm: 'calm', neutral: 'bored', tired: 'tired', anxious: 'anxious', sad: 'sad', angry: 'angry' };
// canvas{touch-action:pan-y}: утсан дээр дүрийн дээгүүр доош гүйлгэхэд хуудас гүйлгэгдэнэ (эргээд, хэлбэрээ хувиргахгүй). Хэвтээ чирвэл эргэнэ.
const EMBED_CSS = '.top,.hint,.moods{display:none!important} body{padding-inline:0!important} canvas{touch-action:pan-y!important}';

type PetApi = { setMood: (id: string) => void; translate?: (text: string) => string };
type PetWin = Window & { Botgo?: PetApi; Character?: PetApi };

export function usePet() {
  return useSyncExternalStore(subscribePet, getPet, () => DEFAULT_PET);
}

export function Botgo3D({ mood, className }: { mood: MoodId; className?: string }) {
  const tr = useT();
  const frame = useRef<HTMLIFrameElement>(null);
  const { resolvedTheme } = useTheme();
  const pet = petById(usePet());
  const [loaded, setLoaded] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const ready = loaded === pet.src;

  // three.js CDN-ээс ачаалагдаж дүр бэлэн болтол хүлээгээд mood өгнө
  useEffect(() => {
    if (!ready) return;
    let left = 40;
    const id = setInterval(() => {
      const w = frame.current?.contentWindow as PetWin | null | undefined;
      const api = w?.Botgo ?? w?.Character;
      if (api) {
        // Хэл солигдоход ч энд ирж, дүр шинэ хэлээр хэлнэ (Ботгоо орчуулгыг дэмждэг)
        api.translate = text => tr(text);
        w?.document.getElementById('c')?.setAttribute('aria-label', tr('{0} 3D дүр', tr(pet.name)));
        api.setMood(TO_PET[mood]);
        clearInterval(id);
      } else if (--left <= 0) clearInterval(id);
    }, 150);
    return () => clearInterval(id);
  }, [ready, mood, tr, pet.name]);

  // Апп-ын гэрэлтэй/харанхуй горимыг дагана (artifact data-theme-ийг дэмждэг)
  useEffect(() => {
    if (ready && resolvedTheme) frame.current?.contentDocument?.documentElement.setAttribute('data-theme', resolvedTheme === 'dark' ? 'dark' : 'light');
  }, [ready, resolvedTheme]);

  const onLoad = () => {
    const doc = frame.current?.contentDocument;
    if (!doc || doc.location.href === 'about:blank') return;
    if (!doc.getElementById('setgel-embed')) {
      const st = doc.createElement('style');
      st.id = 'setgel-embed';
      st.textContent = EMBED_CSS;
      doc.head.appendChild(st);
    }
    setLoaded(new URL(doc.location.href).pathname);
  };

  // Хуудас React-аас өмнө ачаалагдаж дууссан бол onLoad дуудагдахгүй: тэр тохиолдолд шууд тохируулна
  useEffect(() => {
    if (!ready && frame.current?.contentDocument?.readyState === 'complete') onLoad();
  });

  return (
    <div className={cn('relative', className)}>
      {/* key: амьтан солиход iframe шинээр ачаална (өмнөх WebGL-ийг бүрэн чөлөөлнө).
          EMBED_CSS зөвхөн load-ийн дараа орох тул тэр хүртэл нууна: үгүй бол хуудасны өөрийн mood товчнууд анивчина */}
      <iframe key={pet.src} ref={frame} src={pet.src} title={tr('{0} 3D дүр', tr(pet.name))} onLoad={onLoad} loading="lazy"
        className={cn('block size-full rounded-2xl border-0 transition-opacity duration-200', !ready && 'opacity-0')} />
      {!ready && <span className="pointer-events-none absolute inset-0 grid place-items-center text-5xl opacity-60" aria-hidden="true">{pet.emoji}</span>}
      {/* Баруун дээд буланд: дүр солих товч → жижиг цонхонд амьтдаас сонгоно */}
      <button type="button" onClick={() => setPicking(v => !v)} aria-expanded={picking} aria-label={tr('Дүрээ солих')}
        className="absolute top-2.5 right-2.5 flex items-center gap-1 rounded-full bg-background/85 px-2.5 py-1.5 text-sm font-semibold shadow backdrop-blur">
        <span aria-hidden="true">{pet.emoji}</span><span aria-hidden="true">⇄</span>
      </button>
      {picking && <PetPicker onPick={() => setPicking(false)}
        className="absolute top-12 right-2.5 z-10 w-[min(260px,calc(100%-20px))] rounded-2xl bg-popover p-2 shadow-lg ring-1 ring-border" />}
    </div>
  );
}

/* Дуртай амьтнаа сонгох жижиг цонх: сонгосон даруйд 3D дүр солигдоно */
function PetPicker({ className, onPick }: { className?: string; onPick: () => void }) {
  const tr = useT();
  const current = usePet();
  return (
    <div className={cn('grid grid-cols-4 gap-1', className)} role="radiogroup" aria-label={tr('Дуртай амьтнаа сонгох')}>
      {PETS.map(p => (
        <button key={p.id} type="button" role="radio" aria-checked={p.id === current} onClick={() => { setPet(p.id); onPick(); }}
          className={cn('flex min-w-0 flex-col items-center gap-0.5 rounded-xl border-[1.5px] px-1 py-1.5 text-[10px] font-semibold',
            p.id === current ? 'border-primary bg-secondary' : 'border-transparent text-muted-foreground hover:bg-secondary/60')}>
          <span className="text-2xl leading-none" aria-hidden="true">{p.emoji}</span>{tr(p.name)}
        </button>
      ))}
    </div>
  );
}
