import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Нууцлалын бодлого · Сэтгэл' };

// Google OAuth-ийн зөвшөөрлийн дэлгэцэд холбоос болж харагдана. Нэвтрэхгүйгээр нээгдэнэ (proxy.ts → PUBLIC).
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-[720px] px-4 py-10 leading-relaxed [&_h2]:mt-6 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold">
      <h1 className="text-2xl font-bold">Нууцлалын бодлого</h1>
      <p className="mt-2 text-sm text-muted-foreground">Сэтгэл: Mood Tracker</p>

      <h2>Ямар мэдээлэл цуглуулдаг вэ</h2>
      <p>Таны нэр, имэйл (Google-ээр нэвтэрвэл Google бүртгэлийн нэр, имэйл, зураг), таны өөрөө оруулсан сэтгэл санааны бүртгэл, тэмдэглэл, хобби, төлөвлөгөө, AI туслахтай хийсэн чат.</p>

      <h2>Хэрхэн ашигладаг вэ</h2>
      <p>Зөвхөн апп-ын үйлчилгээг үзүүлэхэд: сэтгэл санааны тайлан, зөвлөмж, сануулга. Таны мэдээллийг зарахгүй, зар сурталчилгаанд ашиглахгүй.</p>

      <h2>Хаана хадгалагддаг вэ</h2>
      <p>Supabase-ийн өгөгдлийн санд хадгалагдаж, зөвхөн танд харагдах эрхээр (Row Level Security) хамгаалагдана. AI туслахын хариулт гаргахад бичвэрийг AI үйлчилгээ рүү илгээдэг.</p>

      <h2>Таны эрх</h2>
      <p>Профайл хэсгээс өгөгдлөө татаж авах, бүртгэлээ бүх өгөгдлийн хамт устгах боломжтой.</p>

      <h2>Холбоо барих</h2>
      <p>Асуулт байвал апп доторх профайлын имэйлээр холбогдоно уу.</p>

      <section lang="en" className="mt-10 border-t pt-6 text-sm text-muted-foreground">
        <h2>Privacy policy (English)</h2>
        <p>Setgel Mood Tracker stores your name, email (and Google profile name and picture if you sign in with Google), and the mood entries, notes, hobbies, plans and AI chat you add. It is used only to provide the app: reports, recommendations and reminders. We do not sell your data or use it for advertising. Data is stored in Supabase and protected so only you can access it; chat text is sent to an AI service to generate replies. You can export or delete all of your data from your Profile.</p>
      </section>

      <p className="mt-8"><Link href="/login" className="font-semibold text-primary">← Апп руу буцах</Link></p>
    </main>
  );
}
