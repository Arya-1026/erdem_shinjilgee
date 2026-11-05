'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/password-input';
import { Label } from '@/components/ui/label';
import { useT } from '@/components/providers/locale-provider';

/* Сэргээх кодыг нэг удаа харуулна: өгөгдлийн санд зөвхөн hash нь хадгалагдсан тул дахин харах боломжгүй */
export function RecoveryCode({ code, onDone }: { code: string; onDone: () => void }) {
  const tr = useT();
  async function copy() {
    try { await navigator.clipboard.writeText(code); toast(tr('Хуулагдлаа ✓')); } catch { toast(tr('Кодоо гараар бичиж аваарай')); }
  }
  return (
    <div className="flex flex-col gap-2.5 text-center">
      <div className="text-4xl" aria-hidden="true">🔐</div>
      <h2 className="text-lg font-semibold">{tr('Сэргээх кодоо хадгална уу')}</h2>
      <p className="text-sm text-muted-foreground">{tr('Нууц үгээ мартвал зөвхөн энэ кодоор сэргээнэ. Код дахин харагдахгүй.')}</p>
      <output className="rounded-xl bg-secondary p-3.5 font-mono text-xl font-bold tracking-wider select-all">{code}</output>
      <Button type="button" size="xl" variant="outline" className="w-full" onClick={() => void copy()}>{tr('📋 Хуулах')}</Button>
      <Button type="button" size="xl" className="w-full" onClick={onDone}>{tr('Хадгалсан, үргэлжлүүлэх')}</Button>
    </div>
  );
}

/* Нууц үгээ мартсан үед: имэйл илгээдэггүй тул бүртгүүлэхдээ авсан сэргээх кодоор шинэ нууц үг тохируулна */
export function PasswordReset({ email: fixedEmail, onDone, onCancel }: { email?: string; onDone: (email: string, password: string) => void | Promise<void>; onCancel?: () => void }) {
  const tr = useT();
  const [email, setEmail] = useState(fixedEmail ?? '');
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);

  async function confirm(ev: React.FormEvent) {
    ev.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return void toast(tr('Имэйл хаяг буруу байна'));
    if (pw.length < 6) return void toast(tr('Нууц үг хамгийн багадаа 6 тэмдэгт'));
    if (pw !== pw2) return void toast(tr('Шинэ нууц үг таарахгүй байна'));
    setBusy(true);
    const res = await fetch('/api/auth/recover', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim(), code, password: pw }) });
    const j: { recoveryCode?: string } = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.status === 429) return void toast.error(tr('Хэт олон удаа оролдлоо. Түр хүлээгээд дахин оролдоно уу.'));
    if (res.status === 403) return void toast.error(tr('Имэйл эсвэл сэргээх код буруу байна'));
    if (!res.ok || !j.recoveryCode) return void toast.error(tr('Нууц үг сольж чадсангүй'));
    toast(tr('Нууц үг солигдлоо ✓'));
    setFresh(j.recoveryCode);
  }

  if (fresh) return <RecoveryCode code={fresh} onDone={() => void onDone(email.trim(), pw)} />;

  return (
    <form className="flex flex-col gap-2.5" onSubmit={confirm} noValidate>
      <p className="text-sm text-muted-foreground">{tr('Бүртгүүлэхдээ авсан сэргээх кодоо оруулаад шинэ нууц үгээ тохируулна уу.')}</p>
      {!fixedEmail && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reset-email" className="font-semibold">{tr('Имэйл')}</Label>
          <Input id="reset-email" type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" className="h-12 rounded-xl" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reset-code" className="font-semibold">{tr('Сэргээх код')}</Label>
        <Input id="reset-code" autoComplete="off" autoCapitalize="characters" maxLength={20} placeholder="XXXX-XXXX-XXXX" className="h-12 rounded-xl text-center font-mono tracking-wider"
          value={code} onChange={e => setCode(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reset-pw" className="font-semibold">{tr('Шинэ нууц үг')}</Label>
        <PasswordInput id="reset-pw" autoComplete="new-password" placeholder={tr('Хамгийн багадаа 6 тэмдэгт')} className="h-12 rounded-xl" value={pw} onChange={e => setPw(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reset-pw2" className="font-semibold">{tr('Шинэ нууц үг дахин')}</Label>
        <PasswordInput id="reset-pw2" autoComplete="new-password" className="h-12 rounded-xl" value={pw2} onChange={e => setPw2(e.target.value)} />
      </div>
      <Button type="submit" size="xl" className="w-full" disabled={busy || !code.trim()}>{busy ? tr('Шалгаж байна…') : tr('Нууц үг солих')}</Button>
      {onCancel && <Button type="button" size="xl" variant="outline" className="w-full" onClick={onCancel}>{tr('Болих')}</Button>}
    </form>
  );
}
