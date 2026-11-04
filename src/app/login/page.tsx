import { LoginForm } from './login-form';

// Design system: hero нь «Үүр цайх» градиент (emotion-joy → emotion-love), дээр нь ink текст
export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-6 desk:flex-row desk:gap-18">
      <div className="grad-dawn mb-5 w-full max-w-[420px] rounded-3xl p-6 text-center desk:m-0 desk:p-10 desk:text-left">
        <div className="text-5xl">🌙</div>
        <h1 className="my-2 text-[28px] leading-9 font-bold desk:text-[40px] desk:leading-12">Сэтгэл</h1>
        <p>Өдөр бүрийн сэтгэл санаагаа тэмдэглэж, өөрийгөө илүү сайн ойлгоорой. AI туслах, хувийн зөвлөмж, сэтгэл зүйчийн дэмжлэг нэг дор.</p>
      </div>
      <LoginForm />
    </div>
  );
}
