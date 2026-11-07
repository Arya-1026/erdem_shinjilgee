'use client';

import Link from 'next/link';
import { useApp } from '@/components/providers/app-provider';
import { useT } from '@/components/providers/locale-provider';
import { Button, buttonVariants } from '@/components/ui/button';
import { DASS_SCALES, dassLevel, LEVEL_LABEL, SCALE_LABEL, type DassScores } from '@/lib/dass';
import { cn } from '@/lib/utils';

/* DASS-21 оноо босго давсан үед: сэтгэл зүйчтэй холбогдох мэдээлэл, товчнууд.
   urgent: аль нэг хэмжүүр «Хүнд»+ эсвэл 21-р асуултад 2+ → яаралтай холбогдохыг уриална.
   suggest: «Дунд» түвшин → сэтгэл зүйчтэй зөвлөлдөхийг санал болгоно. */
/** showResult: Нүүр хуудаснаас үр дүн рүү орох холбоос харуулна */
export function DassHelpCard({ level, scores, className, showResult }: { level: 'urgent' | 'suggest'; scores: DassScores; className?: string; showResult?: boolean }) {
  const tr = useT();
  const { setChatOpen } = useApp();
  // Босго давсан хэмжүүрүүд: «Гутрал (Хүнд)»
  const over = DASS_SCALES.filter(k => (level === 'urgent' ? ['severe', 'extreme'] : ['moderate']).includes(dassLevel(k, scores[k])))
    .map(k => `${tr(SCALE_LABEL[k])} (${tr(LEVEL_LABEL[dassLevel(k, scores[k])])})`);

  if (level === 'suggest') return (
    <section className={cn('card-x border-2 border-warn/40', className)}>
      <h2 className="font-bold">🧑‍⚕️ {tr('Сэтгэл зүйчтэй зөвлөлдөхийг санал болгож байна')}</h2>
      <p className="mt-1 text-sm">
        {over.length > 0 && <><b>{over.join(', ')}</b>{' · '}</>}
        {tr('Таны оноо дунд түвшинд хүрсэн байна. Одоохондоо яаралтай биш ч мэргэжлийн хүнтэй нэг удаа ярилцах нь асуудал хүндрэхээс сэргийлдэг.')}
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Link href="/experts" className={buttonVariants({ size: 'xl' })}>{tr('🧑‍⚕️ Сэтгэл зүйчтэй цаг товлох')}</Link>
        <Button size="xl" variant="outline" onClick={() => setChatOpen(true)}>{tr('💬 Ботгоотой ярилцах')}</Button>
      </div>
    </section>
  );

  return (
    <section className={cn('card-x border-2 border-destructive/60 bg-destructive/5', className)} role="alert">
      <h2 className="text-lg font-bold text-destructive">🚨 {tr('Сэтгэл зүйчтэй яаралтай холбогдоорой')}</h2>
      <p className="mt-1 text-sm">
        {over.length > 0 && <><b>{over.join(', ')}</b>{' · '}</>}
        {tr('Таны оноо тогтоосон босгоос давсан байна. Энэ нь таны буруу биш: ийм үед мэргэжлийн хүний дэмжлэг хамгийн их тусалдаг. Аль болох өнөөдөр, хамгийн оройтвол энэ 7 хоногт сэтгэл зүйчтэй ярилцаарай.')}
      </p>
      <div className="mt-3 grid gap-2">
        <Link href="/experts" className={buttonVariants({ size: 'xl' })}>{tr('🧑‍⚕️ Сэтгэл зүйчтэй яаралтай цаг товлох')}</Link>
        <div className="grid gap-2 min-[380px]:grid-cols-2">
          <a className={buttonVariants({ variant: 'destructive', size: 'xl' })} href="tel:108">{tr('📞 108 Тусламжийн утас')}</a>
          <a className={buttonVariants({ variant: 'destructive', size: 'xl' })} href="tel:103">{tr('📞 103 Түргэн тусламж')}</a>
        </div>
        <Button size="xl" variant="outline" onClick={() => setChatOpen(true)}>{tr('💬 Одоо Ботгоотой ярилцах')}</Button>
        {showResult && <Link href="/dass" className={buttonVariants({ size: 'xl', variant: 'ghost' })}>{tr('📊 Асуулгын үр дүн, тайлбар харах')}</Link>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{tr('Өөрийгөө гэмтээх бодол төрж байвал яг одоо 103 руу залгана уу.')}</p>
    </section>
  );
}
