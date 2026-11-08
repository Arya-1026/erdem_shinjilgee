'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useLocale, useT } from '@/components/providers/locale-provider';
import { createClient } from '@/lib/supabase/client';

/* Google-ийн өөрийн «Sign in with Google» товч (Google Identity Services).
   Supabase-ийн OAuth хуудсаар дамжихгүй тул Google-ийн цонхонд supabase.co биш таны сайтын хаяг харагдана.
   Google-ийн өгсөн ID token-ийг Supabase шалгаж session үүсгэнэ (signInWithIdToken). */

// Нийтэд ил байдаг утга (нууц биш): Google Cloud → setgel-mood → Web client 1
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '388220303902-413dc7legn4c07gqpcarov4gnk2ggujf.apps.googleusercontent.com';

type Gsi = {
  accounts: {
    id: {
      initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; nonce: string; use_fedcm_for_button?: boolean; ux_mode?: 'popup' }) => void;
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
    };
  };
};
declare global { interface Window { google?: Gsi } }

let loading: Promise<void> | null = null;
const loadGsi = () => (loading ??= new Promise((ok, fail) => {
  if (window.google?.accounts) return ok();
  const s = document.createElement('script');
  s.src = 'https://accounts.google.com/gsi/client';
  s.async = true;
  s.onload = () => ok();
  s.onerror = () => { loading = null; fail(new Error('gsi')); };
  document.head.appendChild(s);
}));

/** Supabase нь Google-д хэшлэсэн nonce-ийг, өөрт нь түүхийг нь өгөхийг шаарддаг (дахин ашиглахаас сэргийлнэ) */
async function makeNonce() {
  const raw = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24))));
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return { raw, hashed: [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('') };
}

/** fallback: Google-ийн скрипт ачаалагдахгүй үед (хаалттай сүлжээ г.м.) хуучин OAuth шилжүүлэх аргаар нэвтэрнэ */
export function GoogleButton({ onSignedIn, fallback }: { onSignedIn: () => void; fallback: React.ReactNode }) {
  const tr = useT();
  const { locale } = useLocale();
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await loadGsi();
        const nonce = await makeNonce();
        if (!alive || !host.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID, nonce: nonce.hashed, ux_mode: 'popup',
          callback: async ({ credential }) => {
            const { error } = await createClient().auth.signInWithIdToken({ provider: 'google', token: credential, nonce: nonce.raw });
            if (error) return void toast.error(tr('Google-ээр нэвтэрч чадсангүй: {0}', error.message));
            onSignedIn();
          },
        });
        window.google.accounts.id.renderButton(host.current, {
          type: 'standard', theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', logo_alignment: 'center',
          width: Math.min(400, host.current.clientWidth || 320), locale: locale === 'en' ? 'en' : 'mn',
        });
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [locale, onSignedIn, tr]);

  if (failed) return <>{fallback}</>;
  return <div ref={host} className="flex min-h-11 w-full justify-center" aria-label={tr('Google-ээр үргэлжлүүлэх')} />;
}
