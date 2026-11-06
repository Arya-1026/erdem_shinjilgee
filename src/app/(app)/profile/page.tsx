'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { AvatarEditor } from '@/components/avatar';
import { FriendsTile } from '@/components/friends-tile';
import { MoodHistory } from '@/components/mood-history';
import { MoodImages } from '@/components/mood-images';
import { PasswordReset } from '@/components/password-reset';
import { PalettePicker } from '@/components/palette-picker';
import { Segmented } from '@/components/segmented';
import { useSeasonPref } from '@/components/seasonal';
import { isSeasonPref, saveSeasonPref } from '@/lib/season';
import { useApp } from '@/components/providers/app-provider';
import { useLocale } from '@/components/providers/locale-provider';
import { usePlayer } from '@/components/providers/player-provider';
import { Button, buttonVariants } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { streak } from '@/lib/analytics';
import { currentSubscription, pushSupported, showLocal, subscribePush, unsubscribePush } from '@/lib/push-client';
import { isLocale, LOCALE_NAMES, LOCALES } from '@/lib/i18n';
import { applyPalette, DEFAULT_PALETTE, isPaletteId, paletteColors, paletteLabel, type PaletteId } from '@/lib/palettes';
import { AUDIENCE, shortId } from '@/lib/social';
import type { Audience } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useT } from '@/components/providers/locale-provider';

// Сервер дээр theme тодорхойгүй тул hydration-ий дараа л switch-ийг харуулна
const MOOD_AUDIENCE_ICON: Record<Audience, string> = { everyone: '🌐', friends: '👥', nobody: '🔒' };
const MOOD_AUDIENCE_TOAST: Record<Audience, string> = {
  everyone: 'Сэтгэл санаа тань бүх хүнд харагдана 🌐',
  friends: 'Сэтгэл санаа тань зөвхөн найзуудад харагдана 👥',
  nobody: 'Сэтгэл санаагаа нууллаа 🔒',
};
const useMounted =() => useSyncExternalStore(() => () => {}, () => true, () => false);

export default function ProfilePage() {
  const tr = useT();
  const [tab, setTab] = useState<'profile' | 'history'>('profile');
  return (
    <>
      <Segmented full label={tr('Профайлын хэсэг')} className="mb-4 w-full desk:max-w-[420px]" value={tab} onChange={setTab} options={[['profile', tr('👤 Профайл')], ['history', tr('🕘 Түүх')]]} />
      {tab === 'history' ? <MoodHistory /> : <ProfileMain />}
    </>
  );
}

function ProfileMain() {
  const tr = useT();
  const app = useApp();
  const { profile: u, entries, updateProfile, supabase } = app;
  const player = usePlayer();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const seasonPref = useSeasonPref();
  const { locale, setLocale } = useLocale();
  const [pushOn, setPushOn] = useState<boolean | null>(null);
  useEffect(() => { currentSubscription().then(s => setPushOn(Boolean(s))).catch(() => setPushOn(false)); }, []);

  async function exportData() {
    const { data: chat } = await supabase.from('chat_messages').select('role,content,crisis,created_at').order('created_at');
    const { profile, entries, feedback, watchlist, bookings, journals, dayNotes } = app;
    const blob = new Blob([JSON.stringify({ profile, entries, journals, dayNotes, feedback, watchlist, bookings, chat }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'setgel-data.json'; a.click(); URL.revokeObjectURL(a.href);
  }

  async function logout() {
    player.stop();
    await unsubscribePush(supabase).catch(() => {});
    await supabase.auth.signOut();
    router.replace('/login'); router.refresh();
  }

  async function togglePush(on: boolean) {
    if (!on) { await unsubscribePush(supabase); setPushOn(false); return void toast(tr('Энэ төхөөрөмжид мэдэгдэл унтарлаа')); }
    const r = await subscribePush(supabase);
    setPushOn(r === 'ok');
    if (r === 'ok') void showLocal(tr('Сэтгэл 🌙'), tr('Мэдэгдэл идэвхжлээ. Цаг болоход сануулна.'), 'test');
    toast(r === 'ok' ? tr('Мэдэгдэл идэвхжлээ 🔔') : r === 'denied' ? tr('Браузерын тохиргооноос мэдэгдлийг зөвшөөрнө үү') : r === 'unsupported' ? tr('Энэ браузер push мэдэгдэл дэмжихгүй. iPhone дээр эхлээд «Нүүр дэлгэцэнд нэмэх» хэрэгтэй.') : tr('Идэвхжүүлж чадсангүй'));
  }

  async function testPush() {
    const res = await fetch('/api/push/test', { method: 'POST' });
    const j: { sent?: number } = await res.json().catch(() => ({}));
    if (!res.ok) return void toast.error(tr('Сервер дээр push тохируулагдаагүй байна (VAPID түлхүүр)'));
    if (j.sent) return void toast(tr('Мэдэгдэл илгээлээ. Ирэхгүй бол Windows-ын Notifications, Focus Assist-ийг шалгана уу.'));
    toast.error(tr('Энэ төхөөрөмж бүртгэгдээгүй байна. Push-ийг унтрааж дахин асаана уу.'));
  }

  return (
    <div className="grid gap-4 desk:grid-cols-[3fr_2fr] desk:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        <section className="card-x">
          <div className="flex items-center gap-3.5">
            <AvatarEditor />
            <div className="min-w-0">
              <h2 className="flex flex-wrap items-baseline gap-x-2 text-[1.15rem] font-bold">{u.name}
                {/* Бүртгүүлэхэд автоматаар олгогдсон ID: найзууд тань үүгээр хайж олно, дарвал хуулагдана */}
                <button type="button" className="text-sm font-semibold text-muted-foreground hover:text-primary" title={tr('ID хуулах')}
                  onClick={() => void navigator.clipboard?.writeText(shortId(u.id)).then(() => toast(tr('ID хуулагдлаа')))}>#{shortId(u.id)}</button>
              </h2>
              <p className="text-sm [overflow-wrap:anywhere] text-muted-foreground">{u.email}</p>
              {/* Аватар дээрх сэтгэл санааны эможиг хэн харахыг эндээс шууд солино (Нууцлал хэсгийнхтэй ижил тохиргоо) */}
              <label className="mt-1.5 inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-full bg-secondary px-3 text-xs font-semibold">
                <span aria-hidden="true">{MOOD_AUDIENCE_ICON[u.mood_visibility]}</span>
                <span className="sr-only">{tr('Сэтгэл санаагаа хэнд харуулах')}</span>
                <select value={u.mood_visibility} className="min-w-0 max-w-full cursor-pointer truncate bg-transparent text-base focus:outline-none sm:text-xs"
                  onChange={e => { const v = e.target.value as Audience; void updateProfile({ mood_visibility: v }).then(() => toast(tr(MOOD_AUDIENCE_TOAST[v]))); }}>
                  <option value="everyone">{tr('Сэтгэл санаа: Нийтэд')}</option>
                  <option value="friends">{tr('Сэтгэл санаа: Найзуудад')}</option>
                  <option value="nobody">{tr('Сэтгэл санаа: Нууц')}</option>
                </select>
              </label>
            </div>
          </div>
          <div className="my-3.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FriendsTile />
            {[[tr('Бүртгэл'), entries.length], [tr('Дасгал'), u.exercises_done], ['Streak', streak(entries)]].map(([l, v]) => (
              <div key={l} className="rounded-2xl border bg-card p-3.5"><span className="text-xs text-muted-foreground">{l}</span><b className="block text-[1.4rem]">{v}</b></div>
            ))}
          </div>
          {u.fav_artists.length > 0 && <p className="mb-2 text-sm"><b>{tr('Дуртай дуучид:')}</b> {u.fav_artists.join(', ')}</p>}
          <Link href="/dass" className="mb-3.5 flex items-center gap-3 rounded-2xl border bg-card p-3.5 hover:bg-secondary">
            <span className="text-2xl" aria-hidden="true">🧠</span>
            <span className="min-w-0 flex-1"><b className="block">{tr('Сэтгэл зүйн асуулга (DASS-21)')}</b><span className="block text-xs text-muted-foreground">{tr('Гутрал, түгшүүр, стресс · үр дүн, дахин бөглөх')}</span></span>
            <span aria-hidden="true">›</span>
          </Link>
          <h3 className="mb-2 font-semibold">{tr('Миний хобби')}</h3>
          <div className="flex flex-wrap gap-2">{u.hobbies.map(h => <span key={h} className="inline-flex min-h-[38px] items-center rounded-full bg-primary px-3.5 text-sm text-primary-foreground">{tr(h)}</span>)}</div>
          <Link href="/onboarding?edit=1" className={cn(buttonVariants({ variant: 'secondary', size: 'xl' }), 'mt-4 h-auto min-h-11 max-w-full py-2 whitespace-normal')}>{tr('✏️ Хобби, нас, дуучин засах')}</Link>
        </section>
      </div>

      <section className="card-x">
        <h3 className="font-semibold">{tr('Тохиргоо')}</h3>
        {/* Хоёуланг нь зэрэг солино: AppProvider сонгосон хэлийг дагаж профайлд хадгалдаг */}
        <Setting title={tr('Хэл')} sub={tr('Апп, AI туслах, имэйл, сануулгын хэл')}>
          <select aria-label={tr('Хэл')} value={locale} onChange={e => { const v = e.target.value; if (isLocale(v)) { setLocale(v); void updateProfile({ language: v }); } }}
            className="min-h-10 rounded-[10px] border-[1.5px] bg-background px-2.5">
            {LOCALES.map(l => <option key={l} value={l}>{LOCALE_NAMES[l]}</option>)}
          </select>
        </Setting>
        <ThemeSetting />
        <MoodImages />
        <Setting title={tr('Өдөр тутмын сануулга')} sub={tr('Энэ цагт бүртгээгүй бол имэйл, push-ээр сануулна')}>
          <Switch checked={u.reminder_enabled} onCheckedChange={v => updateProfile({ reminder_enabled: v })} aria-label={tr('Сануулга')} />
        </Setting>
        <Setting title={tr('Сануулах цаг')}>
          <input type="time" aria-label={tr('Сануулах цаг')} defaultValue={u.reminder_time.slice(0, 5)} disabled={!u.reminder_enabled}
            className="min-h-10 rounded-[10px] border-[1.5px] bg-background px-2.5 disabled:opacity-50"
            onChange={e => { if (!e.target.value) return; void updateProfile({ reminder_time: e.target.value }); toast(tr('Өдөр бүр {0}-д сануулна', e.target.value)); }} />
        </Setting>
        <Setting title={tr('Push мэдэгдэл')} sub={!mounted ? '' : !pushSupported() ? tr('Энэ браузер дэмжихгүй') : pushOn ? <>{tr('Энэ төхөөрөмж дээр идэвхтэй ·')}{' '}<button className="text-primary" onClick={testPush}>{tr('Туршиж үзэх')}</button></> : tr('Энэ төхөөрөмж дээр')}>
          {mounted && pushSupported() && pushOn !== null && <Switch checked={pushOn} onCheckedChange={v => void togglePush(v)} aria-label={tr('Push мэдэгдэл')} />}
        </Setting>
        <Setting title={tr('Харанхуй горим')} sub={tr('Гэрэлтэй горимд таны сонгосон өнгө хадгалагдана')}>
          {mounted && <Switch checked={resolvedTheme === 'dark'} onCheckedChange={v => setTheme(v ? 'dark' : 'light')} aria-label={tr('Харанхуй горим')} />}
        </Setting>
        <Setting title={tr('Улирлын чимэглэл')} sub={tr('Шинэ жилийн гацуур, цас. «Автомат» нь 12/15–1/5-нд асна')}>
          <select aria-label={tr('Улирлын чимэглэл')} value={seasonPref} onChange={e => { if (isSeasonPref(e.target.value)) saveSeasonPref(e.target.value); }}
            className="min-h-10 rounded-[10px] border-[1.5px] bg-background px-2.5">
            <option value="auto">{tr('Автомат')}</option>
            <option value="newyear">{tr('🎄 Шинэ жил')}</option>
            <option value="off">{tr('Унтраах')}</option>
          </select>
        </Setting>
        <Setting title={tr('2D дүр ашиглах')} sub={tr('Emoji-ийн оронд')}>
          <Switch checked={u.art_mode === 'art'} onCheckedChange={v => updateProfile({ art_mode: v ? 'art' : 'emoji' })} aria-label={tr('2D дүр')} />
        </Setting>
      </section>

      {app.isExpert && (
        <Link href="/expert" className="card-x flex items-center justify-between desk:col-span-2">
          <span><b>{tr('🗂️ Сэтгэл зүйчийн портал')}</b><span className="block text-sm text-muted-foreground">{tr('Захиалгууд, үйлчлүүлэгчийн тайлан')}</span></span><span>→</span>
        </Link>
      )}

      <SocialSection />
      <AccountSection />

      <section className="card-x desk:col-span-2">
        <h3 className="font-semibold">{tr('Нууцлал ба өгөгдөл')}</h3>
        <p className="text-sm text-muted-foreground">{tr('Таны өгөгдөл Supabase дээр хадгалагдаж, Row Level Security-ээр зөвхөн танд харагдана. Таны зөвшөөрөлгүйгээр хэнтэй ч хуваалцахгүй.')}</p>
        <div className="mt-2 flex max-w-[420px] flex-col gap-2.5">
          <Button variant="outline" size="xl" onClick={exportData}>{tr('⬇ Өгөгдлөө татах (JSON)')}</Button>
          <Button variant="outline" size="xl" onClick={logout}>{tr('↩ Гарах')}</Button>
          <Button variant="destructive" size="xl" onClick={() => app.openDialog({ kind: 'wipe' })}>{tr('🗑 Бүртгэл, бүх өгөгдлөө устгах')}</Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">{tr('⚠️ Энэхүү апп нь мэргэжлийн оношилгоо, эмчилгээг орлохгүй. Яаралтай тусламж хэрэгтэй бол 103 руу залгана уу.')}</p>
      </section>
    </div>
  );
}

/* Апп-ын өнгө: «Өнгө солих» дарахад палитрууд доош нээгдэнэ. Сонголт нь «Шинэчлэх» дартал зөвхөн урьдчилж харагдана,
   дармагц бүх системийн (бүх хуудас, цэс, товч, график) өнгө солигдож, профайлд хадгалагдана. */
function ThemeSetting() {
  const tr = useT();
  const { profile: u, updateProfile } = useApp();
  const current: PaletteId = isPaletteId(u.theme) ? u.theme : DEFAULT_PALETTE;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PaletteId>(current);
  const [busy, setBusy] = useState(false);
  const panelId = useId();
  const swatch = (id: PaletteId) => { const c = paletteColors(id); return `linear-gradient(135deg, ${c.from}, ${c.to})`; };

  function toggle() {
    setDraft(current);
    setOpen(o => !o);
  }

  async function apply() {
    setBusy(true);
    applyPalette(draft);
    await updateProfile({ theme: draft });
    setBusy(false);
    setOpen(false);
    toast(tr('🎨 Апп-ын өнгө шинэчлэгдлээ'));
  }

  return (
    <div className="border-b py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="size-10 flex-none rounded-xl border" style={{ background: swatch(current) }} aria-hidden="true" />
          <div className="min-w-0">
            <b>{tr('Апп-ын өнгө')}</b>
            <div className="truncate text-sm text-muted-foreground">{tr('Одоогийн: {0}', tr(paletteLabel(current)))}</div>
          </div>
        </div>
        <Button variant="outline" size="xl" className="h-10 flex-none gap-1.5 px-3.5" aria-expanded={open} aria-controls={panelId} onClick={toggle}>
          🎨 {tr('Өнгө солих')}
          <span aria-hidden="true" className={cn('text-xs transition-transform', open && 'rotate-180')}>▼</span>
        </Button>
      </div>
      {open && (
        <div id={panelId} className="fade-up mt-3 rounded-2xl border bg-background p-3">
          <p className="mb-3 text-sm text-muted-foreground">{tr('Өнгөө сонгоод «Шинэчлэх» дарна уу. Бүх хуудас, цэс, товч, графикийн өнгө солигдоно.')}</p>
          <PalettePicker live={false} value={draft} onChange={setDraft} />
          <div className="sticky bottom-0 -mx-3 -mb-3 mt-3 flex items-center gap-2 rounded-b-2xl border-t bg-background p-3">
            <span className="size-9 flex-none rounded-lg border" style={{ background: swatch(draft) }} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">{tr(paletteLabel(draft))}</span>
            <Button variant="ghost" size="xl" className="h-10 px-3" onClick={() => setOpen(false)}>{tr('Болих')}</Button>
            <Button size="xl" className="h-10 px-4" disabled={busy || draft === current} onClick={() => void apply()}>
              {busy ? tr('Шинэчилж байна…') : tr('✓ Шинэчлэх')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

const FIELD = 'min-h-11 w-full min-w-0 rounded-xl border-[1.5px] bg-background px-3 focus:border-primary focus:outline-none';

/* Нэр, нууц үг солих */
function AccountSection() {
  const tr = useT();
  const { profile: u, updateProfile, supabase } = useApp();
  const [name, setName] = useState(u.name);
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [mode, setMode] = useState<'idle' | 'change' | 'reset'>('idle');
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => { if (alive) setHasPassword(Boolean(data.user?.identities?.some(i => i.provider === 'email'))); });
    return () => { alive = false; };
  }, [supabase]);

  const close = () => { setMode('idle'); setCur(''); setPw(''); setPw2(''); };

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    if (!n || n === u.name) return;
    await updateProfile({ name: n });
    toast(tr('Нэр солигдлоо ✓'));
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) return void toast(tr('Шинэ нууц үг хамгийн багадаа 6 тэмдэгт'));
    if (pw !== pw2) return void toast(tr('Шинэ нууц үг таарахгүй байна'));
    setBusy(true);
    const res = await fetch('/api/account/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current: cur, next: pw }) });
    setBusy(false);
    if (res.status === 403) return void toast.error(tr('Одоогийн нууц үг буруу байна'));
    if (!res.ok) return void toast.error(tr('Нууц үг сольж чадсангүй'));
    toast(tr('Нууц үг солигдлоо ✓'));
    close();
  }

  return (
    <section className="card-x desk:col-span-2">
      <h3 className="mb-2 font-semibold">{tr('Аккаунт')}</h3>
      <form className="flex max-w-[420px] flex-col gap-1.5 border-b pb-3.5" onSubmit={saveName}>
        <label htmlFor="acc-name" className="text-sm font-semibold">{tr('Нэр')}</label>
        <div className="flex gap-2">
          <input id="acc-name" className={FIELD} value={name} maxLength={60} autoComplete="given-name" onChange={e => setName(e.target.value)} />
          <Button type="submit" size="xl" variant="secondary" className="h-11 flex-none" disabled={!name.trim() || name.trim() === u.name}>{tr('Хадгалах')}</Button>
        </div>
      </form>

      <div className="max-w-[420px] pt-3.5">
        <b>{tr('Нууц үг')}</b>
        {mode === 'idle' && (
          <>
            <div className="mb-2.5 text-sm text-muted-foreground">{hasPassword === false ? tr('Та Google-ээр нэвтэрсэн тул нууц үг шаардлагагүй.') : tr('Нууц үгээ мартвал нэвтрэх хуудаснаас шинээр тохируулна.')}</div>
            {hasPassword && (
              <Button size="xl" variant="outline" className="w-full" onClick={() => setMode('change')}>{tr('🔑 Нууц үг солих')}</Button>
            )}
          </>
        )}
        {mode === 'change' && (
          <form className="mt-2 flex flex-col gap-2.5" onSubmit={changePassword} noValidate>
            <input className={FIELD} type="password" autoComplete="current-password" placeholder={tr('Одоогийн нууц үг')} aria-label={tr('Одоогийн нууц үг')} value={cur} onChange={e => setCur(e.target.value)} />
            <input className={FIELD} type="password" autoComplete="new-password" placeholder={tr('Шинэ нууц үг (6+ тэмдэгт)')} aria-label={tr('Шинэ нууц үг')} value={pw} onChange={e => setPw(e.target.value)} />
            <input className={FIELD} type="password" autoComplete="new-password" placeholder={tr('Шинэ нууц үг дахин')} aria-label={tr('Шинэ нууц үг дахин')} value={pw2} onChange={e => setPw2(e.target.value)} />
            <Button type="submit" size="xl" className="w-full" disabled={busy || !cur || !pw}>{busy ? tr('Сольж байна…') : tr('Нууц үг солих')}</Button>
            <button type="button" className="min-h-10 text-sm font-semibold text-primary" onClick={() => setMode('reset')}>{tr('Одоогийн нууц үгээ мартсан уу? Шинээр тохируулах')}</button>
            <Button type="button" size="xl" variant="outline" className="w-full" onClick={close}>{tr('Болих')}</Button>
          </form>
        )}
        {mode === 'reset' && <div className="mt-2"><PasswordReset email={u.email} onDone={close} onCancel={close} /></div>}
      </div>
    </section>
  );
}

/* Нууцлал: профайл, идэвхтэй байдал, mood, зурвас, найзуудын жагсаалтыг хэнд харуулах */
function SocialSection() {
  const tr = useT();
  const { profile: u, updateProfile } = useApp();
  const pick = (key: 'mood_visibility' | 'friends_visibility', label: string, sub: string) => (
    <Setting title={label} sub={sub}>
      <select aria-label={label} value={u[key]} onChange={e => void updateProfile({ [key]: e.target.value as Audience })}
        className="min-h-10 rounded-[10px] border-[1.5px] bg-background px-2.5">
        {AUDIENCE.map(([v, l]) => <option key={v} value={v}>{tr(l)}</option>)}
      </select>
    </Setting>
  );

  return (
    <section id="social" className="card-x desk:col-span-2">
      <h3 className="font-semibold">{tr('🔒 Нууцлал')}</h3>
      <Setting title={tr('Профайл')} sub={tr('Нууц бол нэрээр хайхад олдохгүй, зөвхөн ID-аар олдоно. Зураг тань зөвхөн найздаа харагдана.')}>
        <select aria-label={tr('Профайл')} value={u.profile_visibility} onChange={e => void updateProfile({ profile_visibility: e.target.value as 'public' | 'friends' })}
          className="min-h-10 rounded-[10px] border-[1.5px] bg-background px-2.5">
          <option value="public">{tr('🌐 Нээлттэй')}</option>
          <option value="friends">{tr('🔒 Нууц')}</option>
        </select>
      </Setting>
      {pick('mood_visibility', tr('Сэтгэл санаагаа харуулах'), tr('Таны одоогийн сэтгэл санаа (Нүүр хуудасны бөмбөлөг) хэнд харагдах вэ'))}
      {pick('friends_visibility', tr('Найзуудаа харуулах'), tr('Таны найзуудын жагсаалтыг хэн харах вэ'))}
    </section>
  );
}

function Setting({ title, sub, children }: { title: string; sub?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 border-b py-3 last:border-0">
      <div className="min-w-0"><b>{title}</b>{sub && <div className="text-sm text-muted-foreground">{sub}</div>}</div>
      {children}
    </div>
  );
}
