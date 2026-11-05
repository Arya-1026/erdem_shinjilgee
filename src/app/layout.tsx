import type { Metadata, Viewport } from 'next';
import { Nunito } from 'next/font/google';
import { cookies } from 'next/headers';
import { ThemeProvider } from 'next-themes';
import { Suspense } from 'react';
import { LocaleProvider } from '@/components/providers/locale-provider';
import { Toaster } from '@/components/ui/sonner';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from '@/lib/i18n';
import { PALETTE_KEY, PALETTE_STYLE_ID } from '@/lib/palettes';
import './globals.css';

// Design system-ийн цорын ганц фонт. Кирилл үсгийг заавал оруулна.
const nunito = Nunito({ subsets: ['latin', 'cyrillic'], variable: '--font-nunito', display: 'swap' });

// Хэрэглэгчийн сонгосон өнгийг React ачаалагдахаас өмнө тавина (өнгө анивчихгүй)
const paletteScript = `try{var c=localStorage.getItem('${PALETTE_KEY}');if(c){var s=document.createElement('style');s.id='${PALETTE_STYLE_ID}';s.textContent=c;document.head.appendChild(s)}}catch(e){}`;
// <html lang>-ийг cookie-оос тавина: layout-ийн гадна хэсэг статик тул сервер cookie уншихгүй
const langScript = `try{if(/(?:^|; )${LOCALE_COOKIE}=en(?:;|$)/.test(document.cookie))document.documentElement.lang='en'}catch(e){}`;

export const metadata: Metadata = {
  title: 'Сэтгэл: Mood Tracker',
  description: 'Өдөр бүрийн сэтгэл санаагаа тэмдэглэж, өөрийгөө илүү сайн ойлгоорой.',
  appleWebApp: { capable: true, title: 'Сэтгэл' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#2F7A6B',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="mn" className={nunito.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: paletteScript + langScript }} />
      </head>
      {/* Хөтчийн өргөтгөл body-д attribute нэмдэг (жишээ нь __processed_…__) тул hydration-ийн сэрэмжлүүлгийг дарна */}
      <body suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {/* Cookie унших хэсэг <Suspense> дотор байна (Cache Components-ийн шаардлага) */}
          <Suspense fallback={<div className="grid min-h-dvh place-items-center text-5xl" aria-hidden="true">🌙</div>}>
            <Locale>{children}</Locale>
          </Suspense>
          {/* Дээд талд: доод хэсэгт байрлах тоглуулагчийг дарахгүйн тулд */}
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}

async function Locale({ children }: { children: React.ReactNode }) {
  const v = (await cookies()).get(LOCALE_COOKIE)?.value;
  return <LocaleProvider initial={isLocale(v) ? v : DEFAULT_LOCALE} chosen={isLocale(v)}>{children}</LocaleProvider>;
}
