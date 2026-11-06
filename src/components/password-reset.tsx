'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/password-input';
import { Label } from '@/components/ui/label';
import { useT } from '@/components/providers/locale-provider';

/* Нууц үгээ мартсан үед имэйлээ оруулаад шинэ нууц үгээ шууд тохируулна (/api/auth/recover) */
export function PasswordReset({ email: fixedEmail, onDone, onCancel }: { email?: string; onDone: (email: string, password: string) => void | Promise<void>; onCancel?: () => void }) {
  const tr = useT();
  const [email, setEmail] = useState(fixedEmail ?? '');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);

  async function confirm(ev: React.FormEvent) {
    ev.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return void toast(tr('Имэйл хаяг буруу байна'));
    if (pw.length < 6) return void toast(tr('Нууц үг хамгийн багадаа 6 тэмдэгт'));
    if (pw !== pw2) return void toast(tr('Шинэ нууц үг таарахгүй байна'));
    setBusy(true);
    const res = await fetch('/api/auth/recover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), password: pw }) });
    setBusy(false);
    if (res.status === 429) return void toast.error(tr('Хэт олон удаа оролдлоо. Түр хүлээгээд дахин оролдоно уу.'));
    if (res.status === 404) return void toast.error(tr('Энэ имэйлээр бүртгэл олдсонгүй'));
    if (!res.ok) return void toast.error(tr('Нууц үг сольж чадсангүй'));
    toast(tr('Нууц үг солигдлоо ✓'));
    await onDone(email.trim(), pw);
  }

  return (
    <form className="flex flex-col gap-2.5" onSubmit={confirm} noValidate>
      <p className="text-sm text-muted-foreground">{tr('Шинэ нууц үгээ оруулаад шууд солино.')}</p>
      {!fixedEmail && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-email" className="font-semibold">{tr('Имэйл')}</Label>
          <Input id="reset-email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" className="h-12 rounded-xl" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reset-pw" className="font-semibold">{tr('Шинэ нууц үг')}</Label>
        <PasswordInput id="reset-pw" autoComplete="new-password" placeholder={tr('Хамгийн багадаа 6 тэмдэгт')} className="h-12 rounded-xl" value={pw} onChange={e => setPw(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reset-pw2" className="font-semibold">{tr('Шинэ нууц үг дахин')}</Label>
        <PasswordInput id="reset-pw2" autoComplete="new-password" className="h-12 rounded-xl" value={pw2} onChange={e => setPw2(e.target.value)} />
      </div>
      <Button type="submit" size="xl" className="w-full" disabled={busy || !pw}>{busy ? tr('Шалгаж байна…') : tr('Нууц үг солих')}</Button>
      {onCancel && <Button type="button" size="xl" variant="outline" className="w-full" onClick={onCancel}>{tr('Болих')}</Button>}
    </form>
  );
}
