'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { streak } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { Avatar } from './avatar';
import { ChatWidget } from './chat-widget';
import { DialogHost } from './dialogs/dialog-host';
import { Logo } from './logo';
import { SantaHat, SeasonalNav } from './seasonal';
import { ThemeToggle } from './theme-toggle';
import { useReminder } from './use-reminder';
import { FullPlayer, MiniPlayer } from './player';
import { useApp } from './providers/app-provider';
import { useSocialBadge } from './use-social-badge';
import { useT } from '@/components/providers/locale-provider';

const NAV = [
  ['/home', '🏠', 'Нүүр', 'Өнөөдөр'],
  ['/recs', '✨', 'Зөвлөмж', 'Зөвлөмж'],
  ['/todo', '🗓️', 'Хуваарь', 'Төлөвлөгөө'],
  ['/experts', '🧑‍⚕️', 'Зөвлөгч', 'Сэтгэл зүйчид'],
  ['/friends', '👥', 'Найзууд', 'Найзууд'],
  ['/profile', '👤', 'Профайл', 'Профайл'],
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const tr = useT();
  const path = usePathname();
  const { entries, tint, isExpert, supabase } = useApp();
  const badge = useSocialBadge(supabase);
  const active = NAV.find(([href]) => path.startsWith(href)) ?? NAV[0];
  useReminder();

  return (
    <>
      <nav aria-label={tr('Үндсэн цэс')}
        className="app-nav fixed inset-x-0 bottom-0 z-30 flex border-t bg-card desk:top-0 desk:right-auto desk:w-60 desk:flex-col desk:gap-1 desk:border-t-0 desk:border-r desk:px-3 desk:pt-5">
        <Link href="/home" className="hidden px-3 pt-2 pb-5 text-[1.6rem] desk:block"><Logo /></Link>
        {NAV.map(([href, icon, label]) => {
          const on = href === active[0];
          return (
            <Link key={href} href={href} aria-current={on ? 'page' : undefined}
              className={cn('flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-[.68rem] text-muted-foreground',
                'desk:flex-none desk:flex-row desk:justify-start desk:gap-3 desk:rounded-xl desk:px-3.5 desk:py-3 desk:text-[.95rem]',
                href === '/profile' && 'hidden desk:flex',
                on && 'font-bold text-primary desk:bg-secondary')}>
              <span className="relative text-[1.35rem] leading-none">{icon}<SantaHat />
                {href === '/friends' && badge > 0 && <b className="absolute -top-1.5 -right-2.5 grid min-w-4.5 place-items-center rounded-full bg-primary px-1 text-[.62rem] leading-[1.15rem] text-primary-foreground" aria-label={tr('{0} шинэ', badge)}>{badge > 9 ? '9+' : badge}</b>}
              </span><span>{tr(label)}</span>
            </Link>
          );
        })}
        {isExpert && (
          <Link href="/expert" className="hidden items-center gap-3 rounded-xl px-3.5 py-3 text-[.95rem] text-muted-foreground desk:mt-auto desk:flex">
            <span className="text-[1.35rem] leading-none">🗂️</span><span>{tr('Сэтгэл зүйчийн портал')}</span>
          </Link>
        )}
        <SeasonalNav />
      </nav>

      <div className={cn('shell desk:ml-60', active[0] === '/home' && 'tinted')} style={{ '--mc': tint } as React.CSSProperties}>
        <header className="topbar sticky top-0 z-20 flex items-center justify-between px-4 desk:px-8">
          <h1 className="m-0 text-xl font-bold">{tr(active[3])}</h1>
          <div className="topbar-actions flex items-center gap-2">
            <ThemeToggle />
            <span className="rounded-full bg-warm/25 px-3 py-1.5 text-sm font-bold text-foreground" title={tr('Тасралтгүй бүртгэсэн өдөр')}>🔥 {streak(entries)}</span>
            <Link href="/profile" aria-label={tr('Профайл')} className="rounded-full desk:hidden">
              <Avatar className="size-10" />
            </Link>
          </div>
        </header>
        <main className="app-main">{children}</main>
      </div>

      <MiniPlayer />
      <FullPlayer />
      <ChatWidget />
      <DialogHost />
    </>
  );
}
