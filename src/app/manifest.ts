import type { MetadataRoute } from 'next';

// PWA: утсан дээр "Нүүр дэлгэцэнд нэмэх" боломжтой болгоно (iOS дээр push мэдэгдэлд шаардлагатай)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Сэтгэл: Mood Tracker',
    short_name: 'Сэтгэл',
    description: 'Өдөр бүрийн сэтгэл санаагаа тэмдэглэж, өөрийгөө илүү сайн ойлгоорой.',
    start_url: '/home',
    display: 'standalone',
    background_color: '#FAF8F5',
    theme_color: '#2F7A6B',
    lang: 'mn',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
