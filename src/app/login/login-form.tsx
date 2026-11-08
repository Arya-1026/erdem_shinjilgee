'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/password-input';
import { Label } from '@/components/ui/label';
import { PasswordReset } from '@/components/password-reset';
import { Segmented } from '@/components/segmented';
import { createClient } from '@/lib/supabase/client';
import { LanguageSwitch, useT } from '@/components/providers/locale-provider';

export function LoginIntro() {
  const tr = useT();
  return (
    <>
      <p>{tr('Өдөр бүрийн сэтгэл санаагаа тэмдэглэж, өөрийгөө илүү сайн ойлгоорой. AI туслах, хувийн зөвлөмж, сэтгэл зүйчийн дэмжлэг нэг дор.')}</p>
      <LanguageSwitch className="mt-3" />
    </>
  );
}

export function LoginForm() {
  const tr = useT();
  const router = useRouter();
  const [tab, setTab] = useState<'register' | 'login'>('register');
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const reg = tab === 'register';
  const callback = (next: string) => `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get('name') ?? '').trim(), email = String(f.get('email') ?? '').trim(), password = String(f.get('password') ?? '');
    if (reg && !name) return toast(tr('Нэрээ оруулна уу'));
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast(tr('Имэйл хаяг буруу байна'));
    if (password.length < 6) return toast(tr('Нууц үг хамгийн багадаа 6 тэмдэгт'));

    setBusy(true);
    const supabase = createClient();
    // Бүртгэл шууд өгөгдлийн санд үүснэ, имэйл явахгүй (/api/auth/register)
    if (reg) {
      const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }) });
      if (!res.ok) {
        setBusy(false);
        return void toast.error(res.status === 409 ? tr('Энэ имэйлээр бүртгэл аль хэдийн байна. Нэвтэрнэ үү.') : res.status === 429 ? tr('Хэт олон удаа оролдлоо. Түр хүлээгээд дахин оролдоно уу.') : tr('Бүртгэл үүсгэж чадсангүй. Дахин оролдоно уу.'));
      }
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);

    if (error) return toast.error(error.code === 'email_not_confirmed' ? tr('Энэ бүртгэл идэвхжээгүй байна. «Бүртгүүлэх» хэсгээс дахин бүртгүүлнэ үү.') : error.message === 'Invalid login credentials' ? tr('Имэйл эсвэл нууц үг буруу байна') : error.message);
    enter(reg ? '/onboarding' : '/home');
  }

  function enter(href: string) {
    router.replace(href);
    router.refresh();
  }

  async function google() {
    // Supabase дээр Google идэвхжээгүй бол түүхий JSON алдааны хуудас руу шилжүүлэхгүй
    const settings = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! } })
      .then(r => r.json() as Promise<{ external?: { google?: boolean } }>).catch(() => null);
    if (settings && !settings.external?.google) return void toast.error(tr('Google-ээр нэвтрэх тохиргоо хараахан хийгдээгүй байна. Одоохондоо имэйлээр бүртгүүлж нэвтэрнэ үү.'));
    const { error } = await createClient().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback('/home') } });
    if (error) toast.error(error.message);
  }

  if (forgot) return (
    <div className="card-x w-full max-w-[420px]">
      <h2 className="mb-2 text-lg font-semibold">{tr('🔑 Нууц үг сэргээх')}</h2>
      <PasswordReset onCancel={() => setForgot(false)} onDone={async (email, password) => {
        const { error } = await createClient().auth.signInWithPassword({ email, password });
        if (error) { setForgot(false); return void toast(tr('Шинэ нууц үгээрээ нэвтэрнэ үү')); }
        enter('/home');
      }} />
    </div>
  );

  return (
    <form className="card-x w-full max-w-[420px]" onSubmit={onSubmit} noValidate>
      <Segmented full className="mb-4.5" value={tab} onChange={setTab} options={[['register', tr('Бүртгүүлэх')], ['login', tr('Нэвтрэх')]]} />
      {reg && <Field id="name" label={tr('Нэр')}><Input id="name" name="name" autoComplete="given-name" placeholder={tr('Таны нэр')} className="h-12 rounded-xl" required /></Field>}
      <Field id="email" label={tr('Имэйл')}><Input id="email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" className="h-12 rounded-xl" required /></Field>
      <Field id="password" label={tr('Нууц үг')}><PasswordInput id="password" name="password" autoComplete={reg ? 'new-password' : 'current-password'} placeholder={tr('Хамгийн багадаа 6 тэмдэгт')} minLength={6} className="h-12 rounded-xl" required /></Field>
      {!reg && <button type="button" className="-mt-1.5 mb-3 min-h-9 text-sm font-semibold text-primary" onClick={() => setForgot(true)}>{tr('Нууц үгээ мартсан уу?')}</button>}
      <Button type="submit" size="xl" className="w-full" disabled={busy}>{busy ? '…' : reg ? tr('Бүртгүүлэх') : tr('Нэвтрэх')}</Button>
      <div className="my-3.5 flex items-center gap-2.5 text-sm text-muted-foreground before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">{tr('эсвэл')}</div>
      <Button type="button" variant="outline" size="xl" className="w-full" onClick={google}><b className="text-[#4285F4]">G</b>{' '}{tr('Google-ээр үргэлжлүүлэх')}</Button>
      <p className="mt-4 text-center text-xs text-muted-foreground">{tr('Үргэлжлүүлснээр та үйлчилгээний нөхцөл болон нууцлалын бодлогыг зөвшөөрч байна.')}</p>
    </form>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return <div className="mb-3.5 flex flex-col gap-1.5"><Label htmlFor={id} className="font-semibold">{label}</Label>{children}</div>;
}
