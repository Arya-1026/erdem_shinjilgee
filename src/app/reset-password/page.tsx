'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/password-input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { useT } from '@/components/providers/locale-provider';

// Имэйлээр ирсэн «Reset password» холбоос /auth/callback-аар session үүсгээд энд ирнэ. Шинэ нууц үгээ тохируулна.
export default function ResetPasswordPage() {
  const tr = useT();
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) return void toast(tr('Нууц үг хамгийн багадаа 6 тэмдэгт'));
    if (pw !== pw2) return void toast(tr('Шинэ нууц үг таарахгүй байна'));
    setBusy(true);
    const { error } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return void toast.error(error.code === 'same_password' ? tr('Шинэ нууц үг хуучнаасаа өөр байх ёстой') : error.message);
    toast(tr('Нууц үг солигдлоо ✓'));
    router.replace('/home'); router.refresh();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-6">
      <form className="card-x flex w-full max-w-[420px] flex-col gap-2.5" onSubmit={onSubmit} noValidate>
        <h1 className="text-lg font-semibold">{tr('🔑 Шинэ нууц үг тохируулах')}</h1>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-pw" className="font-semibold">{tr('Шинэ нууц үг')}</Label>
          <PasswordInput id="new-pw" autoComplete="new-password" placeholder={tr('Хамгийн багадаа 6 тэмдэгт')} className="h-12 rounded-xl" value={pw} onChange={e => setPw(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-pw2" className="font-semibold">{tr('Шинэ нууц үг дахин')}</Label>
          <PasswordInput id="new-pw2" autoComplete="new-password" className="h-12 rounded-xl" value={pw2} onChange={e => setPw2(e.target.value)} />
        </div>
        <Button type="submit" size="xl" className="w-full" disabled={busy || !pw}>{busy ? tr('Хадгалж байна…') : tr('Нууц үг солих')}</Button>
      </form>
    </div>
  );
}
