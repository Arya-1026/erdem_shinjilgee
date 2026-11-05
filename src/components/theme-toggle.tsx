'use client';

import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { useT } from '@/components/providers/locale-provider';

const useMounted = () => useSyncExternalStore(() => () => {}, () => true, () => false);

/* Гэрэлтэй / харанхуй горим. Сонгосон өнгө (палитр) хоёуланд нь хадгалагдана. */
export function ThemeToggle() {
  const tr = useT();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  // Сервер theme мэдэхгүй: hydration дуустал үргэлж гэрэлтэй гэж үзнэ, үгүй бол aria-label, title зөрнө
  const dark = mounted && resolvedTheme === 'dark';
  return (
    <button type="button" className="grid size-10 flex-none place-items-center rounded-full border bg-card text-lg" aria-label={dark ? tr('Гэрэлтэй горим') : tr('Харанхуй горим')} title={dark ? tr('Гэрэлтэй горим') : tr('Харанхуй горим')}
      onClick={() => setTheme(dark ? 'light' : 'dark')}>
      {mounted ? (dark ? '☀️' : '🌙') : ''}
    </button>
  );
}
