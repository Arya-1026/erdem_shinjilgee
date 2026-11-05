import { cn } from '@/lib/utils';

/* Хөдөлгөөнт гал (public/flame.svg): тасралтгүй бүртгэсэн өдрийн тэмдэг. «Хөдөлгөөн багасгах» үед зогсоно. */
export function Flame({ className }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- SVG анимаци next/image-ээр тоглохгүй
  return <img src="/flame.svg" alt="" aria-hidden="true" draggable={false} className={cn('inline-block size-[1.15em] align-[-0.2em]', className)} />;
}
