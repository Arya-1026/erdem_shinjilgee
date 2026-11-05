'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/password-input';
import { Label } from '@/components/ui/label';
import { createClient } from '@/lib/supabase/client';
import { useT } from '@/components/providers/locale-provider';

/* Нууц үгээ мартсан үед: имэйл рүү баталгаажуулах код илгээж, кодоо бичээд шинэ нууц үг тохируулна.
   Supabase-ийн «Reset Password» имэйлийн загварт {{ .Token }} байх ёстой (README). */
export function PasswordReset({ email: fixedEmail, onDone, onCancel }: { email?: string; onDone: () => void; onCancel?: () => void }) {
  const tr = useT();
  const [email, setEmail] = useState(fixedEmail ?? '');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    const e = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(e)) return void toast(tr('Имэйл хаяг буруу байна'));
    setBusy(true);
    // Supabase-ийн үндсэн загвар холбоос илгээнэ: /auth/callback → /reset-password. Загварт {{ .Token }} нэмбэл код ч ажиллана.
    const { error } = await createClient().auth.resetPasswordForEmail(e, { redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent('/reset-password')}` });
    setBusy(false);
    if (error) return void toast.error(error.status === 429 ? tr('Хэт олон удаа илгээлээ. Түр хүлээгээд дахин оролдоно уу.') : error.message);
    setSent(true);
    toast(tr('{0} хаяг руу код илгээлээ 📬', e));
  }

  async function confirm(ev: React.FormEvent) {
    ev.preventDefault();
    if (pw.length < 6) return void toast(tr('Нууц үг хамгийн багадаа 6 тэмдэгт'));
    if (pw !== pw2) return void toast(tr('Шинэ нууц үг таарахгүй байна'));
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'recovery' });
    if (error) { setBusy(false); return void toast.error(tr('Код буруу эсвэл хугацаа нь дууссан байна')); }
    const { error: upd } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (upd) return void toast.error(upd.code === 'same_password' ? tr('Шинэ нууц үг хуучнаасаа өөр байх ёстой') : upd.message);
    toast(tr('Нууц үг солигдлоо ✓'));
    onDone();
  }

  if (!sent) return (
    <div className="flex flex-col gap-2.5">
      <p className="text-sm text-muted-foreground">{tr('Имэйл рүү тань баталгаажуулах холбоос, код илгээнэ. Түүгээр шинэ нууц үгээ тохируулна.')}</p>
      {!fixedEmail && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-email" className="font-semibold">{tr('Имэйл')}</Label>
          <Input id="reset-email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" className="h-12 rounded-xl" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
      )}
      <Button type="button" size="xl" className="w-full" disabled={busy} onClick={() => void send()}>{busy ? tr('Илгээж байна…') : `📧 ${fixedEmail ? tr('{0} руу код илгээх', fixedEmail) : tr('Код илгээх')}`}</Button>
      {onCancel && <Button type="button" size="xl" variant="outline" className="w-full" onClick={onCancel}>{tr('Болих')}</Button>}
    </div>
  );

  return (
    <form className="flex flex-col gap-2.5" onSubmit={confirm} noValidate>
      <p className="text-sm text-muted-foreground"><b>{email.trim()}</b>{' '}{tr('руу имэйл илгээлээ. Имэйл дэх холбоос дээр дарж эсвэл кодыг доор бичиж шинэ нууц үгээ тохируулна. Ирэхгүй бол Spam хавтсаа шалгаарай.')}</p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reset-code" className="font-semibold">{tr('Баталгаажуулах код')}</Label>
        <Input id="reset-code" inputMode="numeric" autoComplete="one-time-code" maxLength={10} placeholder="123456" className="h-12 rounded-xl text-center text-lg tracking-[.3em]"
          value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reset-pw" className="font-semibold">{tr('Шинэ нууц үг')}</Label>
        <PasswordInput id="reset-pw" autoComplete="new-password" placeholder={tr('Хамгийн багадаа 6 тэмдэгт')} className="h-12 rounded-xl" value={pw} onChange={e => setPw(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reset-pw2" className="font-semibold">{tr('Шинэ нууц үг дахин')}</Label>
        <PasswordInput id="reset-pw2" autoComplete="new-password" className="h-12 rounded-xl" value={pw2} onChange={e => setPw2(e.target.value)} />
      </div>
      <Button type="submit" size="xl" className="w-full" disabled={busy || code.length < 6}>{busy ? tr('Шалгаж байна…') : tr('Нууц үг солих')}</Button>
      <Button type="button" size="xl" variant="ghost" className="w-full" disabled={busy} onClick={() => void send()}>{tr('↻ Код дахин илгээх')}</Button>
      {onCancel && <Button type="button" size="xl" variant="outline" className="w-full" onClick={onCancel}>{tr('Болих')}</Button>}
    </form>
  );
}
