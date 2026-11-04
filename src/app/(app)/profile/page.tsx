'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { MoodImages } from '@/components/mood-images';
import { PalettePicker } from '@/components/palette-picker';
import { useApp } from '@/components/providers/app-provider';
import { usePlayer } from '@/components/providers/player-provider';
import { Button, buttonVariants } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { streak } from '@/lib/analytics';
import { currentSubscription, pushSupported, showLocal, subscribePush, unsubscribePush } from '@/lib/push-client';
import { DEFAULT_PALETTE, isPaletteId } from '@/lib/palettes';
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
          <div className="grid size-16 flex-none place-items-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--primary-2))] text-2xl font-bold text-white">{u.name[0] || '?'}</div>
          <div className="min-w-0"><h2 className="text-[1.15rem] font-bold">{u.name}</h2><p className="text-sm [overflow-wrap:anywhere] text-muted-foreground">{u.email}</p></div>
        </div>
        <div className="my-3.5 grid grid-cols-3 gap-3">
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

function Setting({ title, sub, children }: { title: string; sub?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 border-b py-3 last:border-0">
      <div className="min-w-0"><b>{title}</b>{sub && <div className="text-sm text-muted-foreground">{sub}</div>}</div>
      {children}
    </div>
  );
}
