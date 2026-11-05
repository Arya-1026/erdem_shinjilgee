'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { AvatarEditor } from '@/components/avatar';
import { FriendsSheet, FriendsTile, type SheetTab } from '@/components/friends-tile';
import { MoodImages } from '@/components/mood-images';
import { PasswordReset } from '@/components/password-reset';
import { PalettePicker } from '@/components/palette-picker';
import { useSeasonPref } from '@/components/seasonal';
import { isSeasonPref, saveSeasonPref } from '@/lib/season';
import { useApp } from '@/components/providers/app-provider';
import { usePlayer } from '@/components/providers/player-provider';
import { Button, buttonVariants } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { streak } from '@/lib/analytics';
import { currentSubscription, pushSupported, showLocal, subscribePush, unsubscribePush } from '@/lib/push-client';
import { DEFAULT_PALETTE, isPaletteId } from '@/lib/palettes';
import { AUDIENCE, cleanHandle, HANDLE_RE, shortId, social, type SocialCounts } from '@/lib/social';
import type { Audience } from '@/lib/types';
import { cn } from '@/lib/utils';

// Сервер дээр theme тодорхойгүй тул hydration-ий дараа л switch-ийг харуулна
const useMounted = () => useSyncExternalStore(() => () => {}, () => true, () => false);

export default function ProfilePage() {
  const app = useApp();
  const { profile: u, entries, updateProfile, supabase } = app;
  const player = usePlayer();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const seasonPref = useSeasonPref();
  const [pushOn, setPushOn] = useState<boolean | null>(null);
  useEffect(() => { currentSubscription().then(s => setPushOn(Boolean(s))).catch(() => setPushOn(false)); }, []);

  async function exportData() {
    const { data: chat } = await supabase.from('chat_messages').select('role,content,crisis,created_at').order('created_at');
    const { profile, entries, feedback, watchlist, bookings } = app;
    const blob = new Blob([JSON.stringify({ profile, entries, feedback, watchlist, bookings, chat }, null, 2)], { type: 'application/json' });
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
    if (!on) { await unsubscribePush(supabase); setPushOn(false); return void toast('Энэ төхөөрөмжид мэдэгдэл унтарлаа'); }
    const r = await subscribePush(supabase);
    setPushOn(r === 'ok');
    if (r === 'ok') void showLocal('Сэтгэл 🌙', 'Мэдэгдэл идэвхжлээ. Цаг болоход сануулна.', 'test');
    toast(r === 'ok' ? 'Мэдэгдэл идэвхжлээ 🔔' : r === 'denied' ? 'Браузерын тохиргооноос мэдэгдлийг зөвшөөрнө үү' : r === 'unsupported' ? 'Энэ браузер push мэдэгдэл дэмжихгүй. iPhone дээр эхлээд «Нүүр дэлгэцэнд нэмэх» хэрэгтэй.' : 'Идэвхжүүлж чадсангүй');
  }

  async function testPush() {
    const res = await fetch('/api/push/test', { method: 'POST' });
    const j: { sent?: number } = await res.json().catch(() => ({}));
    if (!res.ok) return void toast.error('Сервер дээр push тохируулагдаагүй байна (VAPID түлхүүр)');
    if (j.sent) return void toast('Мэдэгдэл илгээлээ. Ирэхгүй бол Windows-ын Notifications, Focus Assist-ийг шалгана уу.');
    toast.error('Энэ төхөөрөмж бүртгэгдээгүй байна. Push-ийг унтрааж дахин асаана уу.');
  }

  return (
    <div className="grid gap-4 desk:grid-cols-[3fr_2fr] desk:items-start">
      <section className="card-x">
        <div className="flex items-center gap-3.5">
          <AvatarEditor />
          <div className="min-w-0"><h2 className="text-[1.15rem] font-bold">{u.name}</h2><p className="text-sm [overflow-wrap:anywhere] text-muted-foreground">{u.email}</p></div>
        </div>
        <div className="my-3.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <FriendsTile />
          {[['Бүртгэл', entries.length], ['Дасгал', u.exercises_done], ['Streak', streak(entries)]].map(([l, v]) => (
            <div key={l} className="rounded-2xl border bg-card p-3.5"><span className="text-xs text-muted-foreground">{l}</span><b className="block text-[1.4rem]">{v}</b></div>
          ))}
        </div>
        {u.fav_artists.length > 0 && <p className="mb-2 text-sm"><b>Дуртай дуучид:</b> {u.fav_artists.join(', ')}</p>}
        <h3 className="mb-2 font-semibold">Миний хобби</h3>
        <div className="flex flex-wrap gap-2">{u.hobbies.map(h => <span key={h} className="inline-flex min-h-[38px] items-center rounded-full bg-primary px-3.5 text-sm text-white">{h}</span>)}</div>
        <Link href="/onboarding?edit=1" className={cn(buttonVariants({ variant: 'secondary', size: 'xl' }), 'mt-4 h-auto min-h-11 max-w-full py-2 whitespace-normal')}>✏️ Хобби, нас, дуучин засах</Link>
      </section>

      <section className="card-x">
        <h3 className="font-semibold">Тохиргоо</h3>
        <div className="border-b py-3">
          <b>Апп-ын өнгө</b>
          <div className="mb-2.5 text-sm text-muted-foreground">Товч, цэс, графикийн үндсэн өнгө</div>
          <PalettePicker compact value={isPaletteId(u.theme) ? u.theme : DEFAULT_PALETTE} onChange={v => void updateProfile({ theme: v })} />
        </div>
        <MoodImages />
        <Setting title="Өдөр тутмын сануулга" sub="Энэ цагт бүртгээгүй бол имэйл, push-ээр сануулна">
          <Switch checked={u.reminder_enabled} onCheckedChange={v => updateProfile({ reminder_enabled: v })} aria-label="Сануулга" />
        </Setting>
        <Setting title="Сануулах цаг">
          <input type="time" aria-label="Сануулах цаг" defaultValue={u.reminder_time.slice(0, 5)} disabled={!u.reminder_enabled}
            className="min-h-10 rounded-[10px] border-[1.5px] bg-background px-2.5 disabled:opacity-50"
            onChange={e => { if (!e.target.value) return; void updateProfile({ reminder_time: e.target.value }); toast(`Өдөр бүр ${e.target.value}-д сануулна`); }} />
        </Setting>
        <Setting title="Push мэдэгдэл" sub={!mounted ? '' : !pushSupported() ? 'Энэ браузер дэмжихгүй' : pushOn ? <>Энэ төхөөрөмж дээр идэвхтэй · <button className="text-primary" onClick={testPush}>Туршиж үзэх</button></> : 'Энэ төхөөрөмж дээр'}>
          {mounted && pushSupported() && pushOn !== null && <Switch checked={pushOn} onCheckedChange={v => void togglePush(v)} aria-label="Push мэдэгдэл" />}
        </Setting>
        <Setting title="Харанхуй горим" sub="Гэрэлтэй горимд таны сонгосон өнгө хадгалагдана">
          {mounted && <Switch checked={resolvedTheme === 'dark'} onCheckedChange={v => setTheme(v ? 'dark' : 'light')} aria-label="Харанхуй горим" />}
        </Setting>
        <Setting title="Улирлын чимэглэл" sub="Шинэ жилийн гацуур, цас. «Автомат» нь 12/15–1/5-нд асна">
          <select aria-label="Улирлын чимэглэл" value={seasonPref} onChange={e => { if (isSeasonPref(e.target.value)) saveSeasonPref(e.target.value); }}
            className="min-h-10 rounded-[10px] border-[1.5px] bg-background px-2.5">
            <option value="auto">Автомат</option>
            <option value="newyear">🎄 Шинэ жил</option>
            <option value="off">Унтраах</option>
          </select>
        </Setting>
        <Setting title="2D дүр ашиглах" sub="Emoji-ийн оронд">
          <Switch checked={u.art_mode === 'art'} onCheckedChange={v => updateProfile({ art_mode: v ? 'art' : 'emoji' })} aria-label="2D дүр" />
        </Setting>
        {app.music.youtube && (
          <Setting title="YouTube" sub={u.youtube_connected ? `Холбогдсон ✓ ${app.youtube?.channel_title ?? ''}` : 'Өөрийн playlist-ээс дуу санал болгоно'}>
            <Switch checked={u.youtube_connected} onCheckedChange={v => (v ? app.musicConnect('youtube') : void app.musicDisconnect('youtube'))} aria-label="YouTube" />
          </Setting>
        )}
        {app.music.spotify && (
          <Setting title="Spotify" sub={u.spotify_connected ? `Холбогдсон ✓ ${app.spotify?.display_name ?? ''}` : 'Өөрийн playlist-ээс дуу санал болгоно'}>
            <Switch checked={u.spotify_connected} onCheckedChange={v => (v ? app.musicConnect('spotify') : void app.musicDisconnect('spotify'))} aria-label="Spotify" />
          </Setting>
        )}
      </section>

      {app.isExpert && (
        <Link href="/expert" className="card-x flex items-center justify-between desk:col-span-2">
          <span><b>🗂️ Сэтгэл зүйчийн портал</b><span className="block text-sm text-muted-foreground">Захиалгууд, үйлчлүүлэгчийн тайлан</span></span><span>→</span>
        </Link>
      )}

      <SocialSection />
      <AccountSection />

      <section className="card-x desk:col-span-2">
        <h3 className="font-semibold">Нууцлал ба өгөгдөл</h3>
        <p className="text-sm text-muted-foreground">Таны өгөгдөл Supabase дээр хадгалагдаж, Row Level Security-ээр зөвхөн танд харагдана. Таны зөвшөөрөлгүйгээр хэнтэй ч хуваалцахгүй.</p>
        <div className="mt-2 flex max-w-[420px] flex-col gap-2.5">
          <Button variant="outline" size="xl" onClick={exportData}>⬇ Өгөгдлөө татах (JSON)</Button>
          <Button variant="outline" size="xl" onClick={logout}>↩ Гарах</Button>
          <Button variant="destructive" size="xl" onClick={() => app.openDialog({ kind: 'wipe' })}>🗑 Бүртгэл, бүх өгөгдлөө устгах</Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">⚠️ Энэхүү апп нь мэргэжлийн оношилгоо, эмчилгээг орлохгүй. Яаралтай тусламж хэрэгтэй бол 103 руу залгана уу.</p>
      </section>
    </div>
  );
}

const FIELD = 'min-h-11 w-full min-w-0 rounded-xl border-[1.5px] bg-background px-3 focus:border-primary focus:outline-none';

/* Нэр, нууц үг солих. Нууц үгээ мартсан (эсвэл Google-ээр бүртгүүлсэн) бол имэйлээр код авч тохируулна. */
function AccountSection() {
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
    toast('Нэр солигдлоо ✓');
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 6) return void toast('Шинэ нууц үг хамгийн багадаа 6 тэмдэгт');
    if (pw !== pw2) return void toast('Шинэ нууц үг таарахгүй байна');
    setBusy(true);
    const res = await fetch('/api/account/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current: cur, next: pw }) });
    setBusy(false);
    if (res.status === 403) return void toast.error('Одоогийн нууц үг буруу байна');
    if (!res.ok) return void toast.error('Нууц үг сольж чадсангүй');
    toast('Нууц үг солигдлоо ✓');
    close();
  }

  return (
    <section className="card-x desk:col-span-2">
      <h3 className="mb-2 font-semibold">Аккаунт</h3>
      <form className="flex max-w-[420px] flex-col gap-1.5 border-b pb-3.5" onSubmit={saveName}>
        <label htmlFor="acc-name" className="text-sm font-semibold">Нэр</label>
        <div className="flex gap-2">
          <input id="acc-name" className={FIELD} value={name} maxLength={60} autoComplete="given-name" onChange={e => setName(e.target.value)} />
          <Button type="submit" size="xl" variant="secondary" className="h-11 flex-none" disabled={!name.trim() || name.trim() === u.name}>Хадгалах</Button>
        </div>
      </form>

      <div className="max-w-[420px] pt-3.5">
        <b>Нууц үг</b>
        {mode === 'idle' && (
          <>
            <div className="mb-2.5 text-sm text-muted-foreground">{hasPassword === false ? 'Та Google-ээр нэвтэрсэн. Имэйлээр код авч нууц үг тохируулж болно.' : 'Нэвтрэхэд ашигладаг нууц үгээ солих'}</div>
            <Button size="xl" variant="outline" className="w-full" disabled={hasPassword === null} onClick={() => setMode(hasPassword ? 'change' : 'reset')}>🔑 {hasPassword === false ? 'Нууц үг тохируулах' : 'Нууц үг солих'}</Button>
          </>
        )}
        {mode === 'change' && (
          <form className="mt-2 flex flex-col gap-2.5" onSubmit={changePassword} noValidate>
            <input className={FIELD} type="password" autoComplete="current-password" placeholder="Одоогийн нууц үг" aria-label="Одоогийн нууц үг" value={cur} onChange={e => setCur(e.target.value)} />
            <input className={FIELD} type="password" autoComplete="new-password" placeholder="Шинэ нууц үг (6+ тэмдэгт)" aria-label="Шинэ нууц үг" value={pw} onChange={e => setPw(e.target.value)} />
            <input className={FIELD} type="password" autoComplete="new-password" placeholder="Шинэ нууц үг дахин" aria-label="Шинэ нууц үг дахин" value={pw2} onChange={e => setPw2(e.target.value)} />
            <Button type="submit" size="xl" className="w-full" disabled={busy || !cur || !pw}>{busy ? 'Сольж байна…' : 'Нууц үг солих'}</Button>
            <button type="button" className="min-h-10 text-sm font-semibold text-primary" onClick={() => setMode('reset')}>Одоогийн нууц үгээ мартсан уу? Имэйлээр код авах</button>
            <Button type="button" size="xl" variant="outline" className="w-full" onClick={close}>Болих</Button>
          </form>
        )}
        {mode === 'reset' && <div className="mt-2"><PasswordReset email={u.email} onDone={() => { setHasPassword(true); close(); }} onCancel={close} /></div>}
      </div>
    </section>
  );
}

/* Найзууд: тоо, хүсэлт, @нэр, ID, нууцлалын тохиргоо */
function SocialSection() {
  const { profile: u, updateProfile, supabase } = useApp();
  const [counts, setCounts] = useState<SocialCounts | null>(null);
  const [handle, setHandle] = useState(u.handle ?? '');
  const [sheet, setSheet] = useState<SheetTab | null>(null);
  useEffect(() => { social.counts(supabase).then(setCounts).catch(() => setCounts(null)); }, [supabase]);

  async function saveHandle(e: React.FormEvent) {
    e.preventDefault();
    const h = cleanHandle(handle);
    if (!HANDLE_RE.test(h)) return void toast('3–20 тэмдэгт: латин жижиг үсэг, тоо, _ эсвэл .');
    if (h === u.handle) return;
    const { error } = await supabase.from('profiles').update({ handle: h }).eq('id', u.id);
    if (error) return void toast.error(error.code === '23505' ? `@${h} нэрийг өөр хүн авсан байна` : 'Хадгалж чадсангүй');
    await updateProfile({ handle: h });
    toast(`Таны нэр @${h} боллоо ✓`);
  }

  const copyId = () => { void navigator.clipboard?.writeText(u.id).then(() => toast('ID хуулагдлаа')); };
  const pick = (key: 'mood_visibility' | 'message_permission' | 'friends_visibility', label: string, sub: string) => (
    <Setting title={label} sub={sub}>
      <select aria-label={label} value={u[key]} onChange={e => void updateProfile({ [key]: e.target.value as Audience })}
        className="min-h-10 rounded-[10px] border-[1.5px] bg-background px-2.5">
        {AUDIENCE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </Setting>
  );

  return (
    <section id="social" className="card-x desk:col-span-2">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">👥 Найзууд</h3>
        <Link href="/friends" className="text-sm font-semibold text-primary">💬 Зурвасууд →</Link>
      </div>
      {/* Найз, хүсэлт, блок нь профайл дээрээ цонхоор нээгдэнэ (Instagram шиг); зурвас нь Найзууд хуудсанд */}
      <div className="mb-3.5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([['Найз', counts?.friends, 'friends'], ['Хүсэлт', counts?.incoming, 'requests'], ['Шинэ зурвас', counts?.unread, null], ['Блоклосон', counts?.blocked, 'blocked']] as const).map(([l, v, tab]) => {
          const cls = cn('rounded-2xl border bg-card p-3.5 text-left transition hover:border-primary', (l === 'Хүсэлт' || l === 'Шинэ зурвас') && v ? 'border-primary' : '');
          const inner = <><span className="text-xs text-muted-foreground">{l}</span><b className="block text-[1.4rem]">{v ?? '–'}</b></>;
          return tab ? <button key={l} type="button" className={cls} onClick={() => setSheet(tab)}>{inner}</button>
            : <Link key={l} href="/friends" className={cls}>{inner}</Link>;
        })}
      </div>
      <FriendsSheet open={sheet !== null} tab={sheet ?? 'friends'} onOpenChange={o => {
        if (o) return;
        setSheet(null);
        social.counts(supabase).then(setCounts).catch(() => {});
      }} />

      <form className="flex max-w-[460px] flex-col gap-1.5 border-b pb-3.5" onSubmit={e => void saveHandle(e)}>
        <label htmlFor="acc-handle" className="text-sm font-semibold">Хэрэглэгчийн нэр (@)</label>
        <div className="flex gap-2">
          <input id="acc-handle" className="min-h-11 w-full min-w-0 rounded-xl border-[1.5px] bg-background px-3 focus:border-primary focus:outline-none"
            placeholder="жишээ нь: tungalag_01" value={handle} maxLength={21} autoCapitalize="none" autoComplete="off" onChange={e => setHandle(e.target.value)} />
          <Button type="submit" size="xl" variant="secondary" className="h-11 flex-none" disabled={!handle.trim() || cleanHandle(handle) === u.handle}>Хадгалах</Button>
        </div>
        <span className="text-xs text-muted-foreground">Найзууд тань @нэр эсвэл ID-аар чинь хайж олно. ID: <button type="button" className="font-semibold text-primary" onClick={copyId}>{shortId(u.id)} ⧉</button></span>
      </form>

      <h4 className="mt-3.5 text-sm font-semibold text-muted-foreground">Нууцлал</h4>
      <Setting title="Профайл" sub="Нууц бол нэрээр хайхад олдохгүй, зөвхөн @нэр, ID-аар олдоно. Зураг тань зөвхөн найздаа харагдана.">
        <select aria-label="Профайл" value={u.profile_visibility} onChange={e => void updateProfile({ profile_visibility: e.target.value as 'public' | 'friends' })}
          className="min-h-10 rounded-[10px] border-[1.5px] bg-background px-2.5">
          <option value="public">🌐 Нээлттэй</option>
          <option value="friends">🔒 Нууц</option>
        </select>
      </Setting>
      {pick('mood_visibility', 'Сэтгэл санаагаа харуулах', 'Таны сүүлийн бүртгэлийн эможиг хэн харах вэ')}
      {pick('message_permission', 'Надад зурвас бичих', 'Хэн танд зурвас бичиж болох вэ')}
      {pick('friends_visibility', 'Найзуудаа харуулах', 'Таны найзуудын жагсаалтыг хэн харах вэ')}
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
