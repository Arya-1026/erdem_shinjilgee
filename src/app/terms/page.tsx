import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Үйлчилгээний нөхцөл · Сэтгэл' };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-[720px] px-4 py-10 leading-relaxed [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold">
      <h1 className="text-2xl font-bold">Үйлчилгээний нөхцөл</h1>
      <p className="mt-2 text-sm text-muted-foreground">Сэтгэл: Mood Tracker</p>

      <h2>Үйлчилгээ</h2>
      <p>Сэтгэл нь өдөр тутмын сэтгэл санаагаа тэмдэглэж, өөртөө тохирох зөвлөмж авах үнэгүй апп юм.</p>

      <h2>Эмчилгээг орлохгүй</h2>
      <p>Апп болон AI туслах нь мэргэжлийн оношилгоо, эмчилгээг орлохгүй. Яаралтай тусламж хэрэгтэй бол 103 руу залгана уу.</p>

      <h2>Хэрэглэгчийн үүрэг</h2>
      <p>Бусдыг гомдоох, хууль бус агуулга оруулахгүй байх. Бүртгэлийнхээ нэвтрэх мэдээллийг өөрөө хамгаална.</p>

      <h2>Өөрчлөлт</h2>
      <p>Нөхцөл өөрчлөгдвөл апп дотор мэдэгдэнэ. Үргэлжлүүлэн ашигласнаар шинэ нөхцөлийг зөвшөөрсөнд тооцно.</p>

      <section lang="en" className="mt-10 border-t pt-6 text-sm text-muted-foreground">
        <h2>Terms of service (English)</h2>
        <p>Setgel is a free app for tracking your mood and getting personal suggestions. It does not replace professional diagnosis or treatment; in an emergency call 103. Do not post harmful or illegal content and keep your sign-in details safe. If these terms change we will notify you in the app; continuing to use the app means you accept them.</p>
      </section>

      <p className="mt-8">
        <Link href="/privacy" className="font-semibold text-primary">Нууцлалын бодлого</Link>
        {' · '}
        <Link href="/login" className="font-semibold text-primary">← Апп руу буцах</Link>
      </p>
    </main>
  );
}
