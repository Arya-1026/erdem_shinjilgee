import { Logo } from '@/components/logo';
import { LoginForm, LoginIntro } from './login-form';

// Hero нь хэрэглэгчийн сонгосон өнгөний градиент (grad-dawn), дээр нь ink текст
export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-6 desk:flex-row desk:gap-18">
      <div className="grad-dawn mb-5 w-full max-w-[420px] rounded-3xl p-6 text-center desk:m-0 desk:p-10 desk:text-left">
        <h1 className="my-2 text-[40px] desk:text-[56px]"><Logo className="logo-ink" /></h1>
        <LoginIntro />
      </div>
      <LoginForm />
    </div>
  );
}
