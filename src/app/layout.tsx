import type { Metadata, Viewport } from 'next';
import { Nunito } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { PALETTE_KEY } from '@/lib/palettes';
import './globals.css';

// Design system-ийн цорын ганц фонт. Кирилл үсгийг заавал оруулна.
const nunito = Nunito({ subsets: ['latin', 'cyrillic'], variable: '--font-nunito', display: 'swap' });

// Хэрэглэгчийн сонгосон өнгийг React ачаалагдахаас өмнө тавина (өнгө анивчихгүй)
const paletteScript = `try{var p=localStorage.getItem('${PALETTE_KEY}');if(p)document.documentElement.dataset.palette=p}catch(e){}`;

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
        <script dangerouslySetInnerHTML={{ __html: paletteScript }} />
      </head>
      {/* Хөтчийн өргөтгөл body-д attribute нэмдэг (жишээ нь __processed_…__) тул hydration-ийн сэрэмжлүүлгийг дарна */}
      <body suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
          {/* Дээд талд: доод хэсэгт байрлах YouTube тоглуулагчийг дарахгүйн тулд */}
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
