'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { SupportBody } from '@/components/daily-support';
import { DayJournalForm } from '@/components/day-journal';
import { ExerciseCoach } from '@/components/exercise/coach';
import { PLAYERS, PlayerFrame } from '@/components/exercise/player-frame';
import { StepCoach } from '@/components/exercise/steps';
import { BENEFITS } from '@/lib/exercise-benefits';
import { MoodFace } from '@/components/mood-face';
import { Poster } from '@/components/poster';
import { useApp, type DialogState } from '@/components/providers/app-provider';
import { usePlayer } from '@/components/providers/player-provider';
import { Segmented } from '@/components/segmented';
import { usePlay } from '@/components/use-play';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { BREATH_LEAD, startBreathMusic } from '@/lib/calm-audio';
import { RECS, WD_SHORT, moodById } from '@/lib/data';
import { dassPopupReady, snoozeDass } from '@/lib/dass-client';
import { signOutAndReload } from '@/lib/user-storage';
import { shownMovie } from '@/components/use-movies';
import { addDays, ymd } from '@/lib/date';
import { cn } from '@/lib/utils';
import { useT } from '@/components/providers/locale-provider';

// Гар утсан дээр доороос гарч ирэх sheet, том дэлгэцэн дээр голд
export const SHEET = 'top-auto bottom-0 left-0 max-h-[92dvh] max-w-full grid-cols-[minmax(0,1fr)] overflow-x-hidden translate-x-0 translate-y-0 gap-0 overflow-auto rounded-t-[22px] rounded-b-none px-[18px] pt-[22px] pb-[calc(22px+var(--safe-b))] text-base ring-0 max-sm:data-open:zoom-in-100 max-sm:data-open:slide-in-from-bottom-10 max-sm:data-closed:zoom-out-100 max-sm:data-closed:slide-out-to-bottom-10 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-w-[520px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[22px] sm:p-[26px]';

export function DialogHost() {
  const tr = useT();
  const { dialog, openDialog, chatOpen, dassPending, setDassPending } = useApp();
  // Анхны бүртгэлийн дараах DASS-21 popup: «Бүртгэгдлээ» цонх (түүнээс нээсэн дасгал, чат) хаагдсаны дараа,
  // хаах animation, дараагийн хуудас руу шилжилт дуусахыг хүлээж гаргана
  useEffect(() => {
    if (!dassPopupReady(dassPending, Boolean(dialog), chatOpen)) return;
    const t = setTimeout(() => { setDassPending(false); openDialog({ kind: 'dass' }); }, 700);
    return () => clearTimeout(t);
  }, [dassPending, dialog, chatOpen, openDialog, setDassPending]);
  // Хаах animation дуусах хүртэл сүүлийн агуулгыг хадгална
  const [shown, setShown] = useState<DialogState>(dialog);
  if (dialog && dialog !== shown) setShown(dialog);
  const d = dialog ?? shown;
  return (
    <Dialog open={Boolean(dialog)} onOpenChange={o => { if (!o) openDialog(null); }}>
      <DialogContent className={SHEET}>
        {d?.kind === 'saved' && <Saved mood={d.mood} />}
        {d?.kind === 'dass' && <DassOffer />}
        {d?.kind === 'exercise' && <Exercise recId={d.recId} />}
        {d?.kind === 'breath' && <Breath />}
        {d?.kind === 'wipe' && <Wipe />}
        {d?.kind === 'journal' && <><Title>{tr('📔 Өдрийн тэмдэглэл')}</Title><DialogDescription>{tr('Өдрийн ерөнхий сэтгэл санаа')}</DialogDescription><DayJournalForm key={d.date} date={d.date} onDone={() => openDialog(null)} /></>}
        {d?.kind === 'movie' && <Movie recId={d.recId} moodId={d.mood} />}
        {d?.kind === 'book' && <Book key={d.expertId} expertId={d.expertId} />}
      </DialogContent>
    </Dialog>
  );
}

const Title = ({ children, className }: { children: React.ReactNode; className?: string }) =>
  <DialogTitle className={cn('mb-2 pr-11 text-[1.15rem] leading-tight font-bold', className)}>{children}</DialogTitle>;

function Saved({ mood }: { mood: Parameters<typeof moodById>[0] }) {
  const tr = useT();
  const { openDialog, setChatOpen } = useApp();
  const play = usePlay();
  const router = useRouter();
  const m = moodById(mood);
  const go = (href: string) => { openDialog(null); router.push(href); };
  return (
    <>
      <div className="text-center">
        <MoodFace m={m} className="mx-auto mb-2.5 size-22 text-[4rem]" />
        <Title className="pr-0">{tr('Бүртгэгдлээ!')}</Title>
        <DialogDescription className="text-sm">{tr('Таны өнөөдрийн бүртгэлд тулгуурласан дэмжлэг')}</DialogDescription>
      </div>
      <div className="mt-3 rounded-2xl bg-secondary/60 p-3.5">
        <SupportBody compact />
      </div>
      <div className="mt-4 flex flex-col gap-2.5">
        {['anxious', 'angry', 'sad'].includes(m.id) && <Button size="xl" onClick={() => openDialog({ kind: 'breath' })}>{tr('🫁 Амьсгалын дасгал хийх')}</Button>}
        <Button size="xl" className="bg-spotify hover:bg-spotify/85" onClick={() => { openDialog(null); play.mood(m.id); }}>{tr('▶ Тохирох дуу сонсох')}</Button>
        <Button size="xl" variant="secondary" onClick={() => go('/recs')}>{tr('✨ Зөвлөмж харах')}</Button>
        <Button size="xl" variant="outline" onClick={() => { openDialog(null); setChatOpen(true); }}>{tr('💬 AI-тай ярилцах')}</Button>
      </div>
    </>
  );
}

/* Анхны сэтгэл санааны бүртгэлийн дараа: DASS-21-ийг одоо эхлэх эсвэл дараа нь бөглөх */
function DassOffer() {
  const tr = useT();
  const { openDialog } = useApp();
  const router = useRouter();
  const start = () => { openDialog(null); router.push('/dass?first=1'); };
  // Хойшлуулбал 3 хоног сануулахгүй
  const later = () => { snoozeDass(); openDialog(null); };
  return (
    <>
      <div className="text-center">
        <div className="mb-2 text-[4rem] leading-none" aria-hidden="true">🐫</div>
        <Title className="pr-0">{tr('Сэтгэл зүйн богино асуулга бөглөх үү?')}</Title>
        <DialogDescription className="text-sm">{tr('Сүүлийн 7 хоногт ямар байсныг чинь мэдвэл илүү тохирсон зөвлөгөө өгч чадна. 21 богино асуулт, 3 минут орчим.')}</DialogDescription>
      </div>
      <div className="mt-3 rounded-2xl bg-secondary/60 p-3.5 text-sm">
        <b className="mb-1.5 block">{tr('Сэтгэл зүйн асуулга (DASS-21)')}</b>
        <ul className="grid gap-1">
          <li>📊 {tr('Гутрал, түгшүүр, стресс гурвыг тус тусад нь харуулна.')}</li>
          <li>🔒 {tr('Хариулт тань зөвхөн танд харагдана. Найзуудад харагдахгүй.')}</li>
          <li>🩺 {tr('Энэ бол скрининг, эмчийн онош биш.')}</li>
        </ul>
      </div>
      <div className="mt-4 flex flex-col gap-2.5">
        <Button size="xl" onClick={start}>{tr('▶ Одоо эхлэх')}</Button>
        {/* Үндсэн товчноос ялгарах бүдэг саарал */}
        <Button size="xl" variant="ghost" className="bg-[color-mix(in_oklch,var(--muted),var(--foreground)_6%)] text-muted-foreground hover:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_12%)] hover:text-foreground dark:hover:bg-[color-mix(in_oklch,var(--muted),var(--foreground)_12%)]" onClick={later}>{tr('Дараа нь бөглөх')}</Button>
      </div>
    </>
  );
}

function Exercise({ recId }: { recId: string }) {
  const tr = useT();
  const { openDialog, bumpExercises } = useApp();
  const r = RECS.find(x => x.id === recId)!;
  const [done, setDone] = useState(false);
  // Дуусмагц бүртгээд «юу өөрчлөгдөх вэ» тайлбарыг харуулна
  const finish = () => { if (!done) { bumpExercises(); toast(tr('Сайн байна! Дасгал бүртгэгдлээ 🎉')); } setDone(true); };
  return (
    <>
      <Title>{tr(r.title)}</Title>
      <DialogDescription>{tr(r.sub)}</DialogDescription>
      {!done && <Benefit id={r.id} />}
      {/* Тоглуулагч өөрөө «дууслаа» дэлгэцтэй тул түүнийг үлдээж, доор нь тайлбар нэмнэ */}
      {PLAYERS[r.id] ? <>
          <PlayerFrame src={PLAYERS[r.id]} title={tr(r.title)} onComplete={finish} onClose={() => openDialog(null)} />
          {done && <Outcome id={r.id} />}
        </>
        : done ? <Outcome id={r.id} />
        : r.moves ? <ExerciseCoach recId={r.id} moves={r.moves} onFinish={finish} /> : <StepCoach recId={r.id} steps={r.steps ?? []} sub={r.sub} onFinish={finish} />}
    </>
  );
}

/* Дасгалын эхэнд: хийснээр юу өөрчлөгдөхийг урьдчилан хэлж, хийх урам өгнө (дуусахад Outcome-д дахин гарна) */
function Benefit({ id }: { id: string }) {
  const tr = useT();
  const text = BENEFITS[id];
  if (!text) return null;
  return (
    <div className="mt-2 mb-1 rounded-[18px] bg-secondary/60 p-3.5">
      <p className="text-sm font-semibold text-muted-foreground">{tr('🌿 Энэ дасгалыг хийснээр:')}</p>
      <p className="mt-1 text-sm leading-relaxed">{tr(text)}</p>
    </div>
  );
}

/* Дасгалын төгсгөл: хийснээр сэтгэл зүйд юу өөрчлөгдөхийг тайлбарлана */
function Outcome({ id }: { id: string }) {
  const tr = useT();
  const { openDialog } = useApp();
  const text = BENEFITS[id];
  return (
    <div className="fade-up mt-3" role="status">
      <div className="rounded-[18px] bg-secondary p-4">
        <p className="text-lg font-bold">{tr('🌿 Дасгал дууслаа')}</p>
        {text && <>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">{tr('Энэ дасгалыг хийснээр:')}</p>
          <p className="mt-1">{tr(text)}</p>
        </>}
        <p className="mt-3 text-sm text-muted-foreground">{tr('Тогтмол давтах тусам үр нөлөө нь нэмэгддэг. Одоо биеэ, сэтгэлээ хэсэг ажиглаарай.')}</p>
      </div>
      <Button size="xl" className="mt-3 w-full" onClick={() => openDialog(null)}>{tr('✓ Хаах')}</Button>
    </div>
  );
}

const PHASES: [string, number, number][] = [['Амьсгал ав', 4, 1], ['Барь', 7, 1], ['Гарга', 8, 0.62]];
const CYCLES = 4;
const SOUND_KEY = 'setgel-breath-sound';

/* Хуучин тойрог: дотор нь тэлж агшина, гадна нь цагираг тухайн үе шатын хугацаагаар тойрч дуусна */
function Breath() {
  const tr = useT();
  const { bumpExercises } = useApp();
  const [state, setState] = useState<{ label: string; sec: number; scale: number; cycle: number; step: number } | null>(null);
  const [left, setLeft] = useState(0);
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined), tick = useRef<ReturnType<typeof setInterval>>(undefined);
  // Тайвшруулах ая (Web Audio): сонголтыг энэ төхөөрөмж дээр санана, анх асаалттай
  const [sound, setSound] = useState(() => { try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; } });
  const audio = useRef<ReturnType<typeof startBreathMusic>>(null);
  const [prep, setPrep] = useState(0);
  useEffect(() => () => { clearTimeout(timer.current); clearInterval(tick.current); audio.current?.stop(); }, []);

  function toggleSound() {
    const on = !sound;
    setSound(on);
    try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* хувийн цонх */ }
    audio.current?.setMuted(!on);
  }

  function start() {
    let cycle = 0, i = 0, n = 0;
    // Товч дарсан мөчид эхлүүлнэ: хөтөч дууг зөвхөн хэрэглэгчийн үйлдлээр зөвшөөрдөг.
    // Ая бүхэлдээ урьдчилан төлөвлөгдөнө (унтраасан ч чимээгүй явна) тул асаахад цагирагтай таарсан хэвээр.
    audio.current = startBreathMusic(CYCLES, !sound);
    const step = () => {
      clearInterval(tick.current);
      if (i === PHASES.length) { i = 0; cycle++; }
      if (cycle === CYCLES) { setDone(true); setState(null); bumpExercises(); audio.current?.finish(); audio.current = null; return; }
      const [label, sec, scale] = PHASES[i++];
      setState({ label, sec, scale, cycle, step: ++n });
      setLeft(sec);
      tick.current = setInterval(() => setLeft(x => Math.max(1, x - 1)), 1000);
      timer.current = setTimeout(step, sec * 1000);
    };
    // «Бэлдээрэй»: ая аажмаар орж ирэх хооронд
    setPrep(BREATH_LEAD);
    tick.current = setInterval(() => setPrep(x => Math.max(1, x - 1)), 1000);
    timer.current = setTimeout(() => { setPrep(0); step(); }, BREATH_LEAD * 1000);
  }

  return (
    <>
      <Title>{tr('4-7-8 амьсгал')}</Title>
      <DialogDescription>{tr('Тав тухтай суугаад цагирагийг дагаарай: 4 сек амьсгал авч, 7 сек барьж, 8 сек гаргана.')}</DialogDescription>
      {!state && !prep && !done && <Benefit id="e1" />}
      <div className="breath-wrap">
        <svg viewBox="0 0 120 120" className="breath-ring" aria-hidden="true">
          <circle cx="60" cy="60" r="55" className="breath-track" />
          {state && (
            <g key={state.step} className="breath-spin" style={{ animationDuration: `${state.sec}s` }}>
              <circle cx="60" cy="60" r="55" pathLength={100} className="breath-arc" style={{ animationDuration: `${state.sec}s` }} />
              <circle cx="115" cy="60" r="4" className="breath-dot" />
            </g>
          )}
        </svg>
        <div className="breath" style={state ? { transitionDuration: `${state.sec}s`, transform: `scale(${state.scale})` } : undefined}>
          <span>{done ? tr('Сайн байна 🌿') : state ? tr(state.label) : prep ? tr('Бэлдээрэй') : tr('Бэлэн үү?')}{(state || prep > 0) && <b className="block text-2xl tabular-nums">{state ? left : prep}</b>}</span>
        </div>
      </div>
      <p className="text-center text-muted-foreground" aria-live="polite">{done ? tr('Дасгал дууслаа') : state ? tr('{0} / {1} давталт', state.cycle + 1, CYCLES) : tr('{0} давталт', CYCLES)}</p>
      {!done && (
        <button type="button" onClick={toggleSound} aria-pressed={sound}
          className="mx-auto mb-1 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-secondary">
          <span aria-hidden="true">{sound ? '🔔' : '🔕'}</span>{sound ? tr('Тайвшруулах ая асаалттай') : tr('Тайвшруулах ая унтраалттай')}
        </button>
      )}
      {!state && !prep && !done && <Button size="xl" className="mt-2 w-full" onClick={start}>{tr('Эхлэх')}</Button>}
      {done && <Outcome id="e1" />}
    </>
  );
}

/* Бүртгэл устгах: нууц үгээр баталгаажуулна. Google-ээр орсон бол нууц үггүй тул имэйлээ бичнэ. */
function Wipe() {
  const tr = useT();
  const { supabase, profile, openDialog } = useApp();
  const { stop } = usePlayer();
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => { if (alive) setHasPassword(Boolean(data.user?.identities?.some(i => i.provider === 'email'))); });
    return () => { alive = false; };
  }, [supabase]);

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch('/api/account', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(hasPassword ? { password: secret } : { email: secret }) });
    if (!res.ok) { setBusy(false); return void toast.error(res.status === 403 ? (hasPassword ? tr('Нууц үг буруу байна') : tr('Имэйл таарахгүй байна')) : tr('Устгаж чадсангүй')); }
    stop();
    // Бүтэн дахин ачаалах тул мэдэгдлийг нэвтрэх хуудас ?deleted=1-ээр харуулна
    await signOutAndReload(supabase, '/login?deleted=1');
  }

  return (
    <form onSubmit={e => void confirm(e)}>
      <Title>{tr('Бүртгэл, бүх өгөгдлөө устгах')}</Title>
      <DialogDescription>{tr('Та бүх төхөөрөмжөөс гарна.')}{' '}<b>{tr('30 хоногийн дотор')}</b>{' '}{tr('дахин нэвтэрвэл бүртгэл тань сэргээгдэнэ. Нэвтрэхгүй бол бүх бүртгэл, чат, төлөвлөгөө бүрмөсөн устгагдаж, буцаах боломжгүй болно.')}</DialogDescription>
      <label htmlFor="wipe-secret" className="mt-3 mb-1.5 block text-sm font-semibold">{hasPassword === false ? tr('Баталгаажуулахын тулд имэйлээ бичнэ үү ({0})', profile.email) : tr('Нууц үгээ оруулна уу')}</label>
      <input id="wipe-secret" type={hasPassword === false ? 'email' : 'password'} autoComplete={hasPassword === false ? 'off' : 'current-password'} value={secret} onChange={e => setSecret(e.target.value)} required
        className="min-h-12 w-full rounded-xl border-[1.5px] bg-background px-3.5 focus:border-primary focus:outline-none" />
      <Button type="submit" size="xl" variant="destructive" className="mt-3 w-full" disabled={busy || !secret || hasPassword === null}>{busy ? tr('Устгаж байна…') : tr('🗑 Бүрмөсөн устгах')}</Button>
      <Button type="button" size="xl" variant="outline" className="mt-2 w-full" onClick={() => openDialog(null)}>{tr('Болих')}</Button>
    </form>
  );
}

function Movie({ recId, moodId }: { recId: string; moodId: Parameters<typeof moodById>[0] }) {
  const tr = useT();
  const { openDialog, watchlist, toggleWatch, setFeedback } = useApp();
  const r = shownMovie(recId), m = moodById(moodId);
  if (!r) return <Title>{tr('Кино олдсонгүй')}</Title>;
  return (
    <>
      {/* Өндөр нь тогтмол: постерын жинхэнэ хэмжээ доорх бичвэр дээр давхцахгүй */}
      <div className="tile-cover -mt-1 mb-3.5 flex h-[230px] items-center justify-center overflow-hidden rounded-[18px] py-3 text-6xl" style={{ '--tc': moodById(r.moods[0]).color } as React.CSSProperties}>
        <Poster src={r.poster} title={tr(r.title)} className="h-full max-h-full w-auto max-w-full rounded-xl object-contain shadow-[0_8px_24px_rgba(0,0,0,.35)]" />
      </div>
      <Title>{tr(r.title)}</Title>
      <DialogDescription className="mb-2">{tr(r.sub)}</DialogDescription>
      {r.desc && <p className="mb-3 text-sm" lang="en">{r.desc}</p>}
      <div className="rounded-[18px] bg-secondary p-3">
        <b className="text-sm">{tr('💡 Яагаад санал болгож байна вэ?')}</b>
        <p className="mt-1 text-sm">{tr('«{0}» мэдрэмжтэй үед:', tr(m.label))} {r.why}</p>
      </div>
      {r.imdb && <a href={r.imdb} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm font-semibold text-primary">{tr('IMDb дээр харах ↗')}</a>}
      <div className="mt-4 flex flex-col gap-2.5">
        <Button size="xl" onClick={async () => { const added = await toggleWatch(r.id); openDialog(null); toast(added ? tr('Үзэх жагсаалтад нэмэгдлээ 🎬') : tr('Жагсаалтаас хасагдлаа')); }}>
          {watchlist.includes(r.id) ? tr('✓ Үзэх жагсаалтад байна') : tr('＋ Үзэх жагсаалтад нэмэх')}
        </Button>
        <Button size="xl" variant="outline" onClick={() => { setFeedback(r.id, 1); openDialog(null); toast(tr('Баярлалаа! Илүү ойролцоо санал болгоно 👍')); }}>{tr('👍 Таалагдсан')}</Button>
      </div>
    </>
  );
}

function Book({ expertId }: { expertId: string }) {
  const tr = useT();
  const { supabase, openDialog, addBooking, experts, slots } = useApp();
  const e = experts.find(x => x.id === expertId)!;
  const [day, setDay] = useState(0);
  const [slot, setSlot] = useState<string | null>(null);
  const [kind, setKind] = useState<'video' | 'chat'>('video');
  const [share, setShare] = useState(true);
  const [busy, setBusy] = useState(false);
  const [days] = useState(() => [...Array(14)].map((_, i) => addDays(new Date(), i + 1)));
  const [booked, setBooked] = useState<Set<string> | null>(null);
  const [version, setVersion] = useState(0);

  // Аль хэдийн захиалагдсан цагууд (хэн захиалсныг харуулахгүй)
  useEffect(() => {
    let alive = true;
    supabase.rpc('booked_slots', { p_expert: e.id, p_from: ymd(days[0]), p_to: ymd(days[days.length - 1]) })
      .then(({ data }) => { if (alive) setBooked(new Set((data as { booking_date: string; slot: string }[] ?? []).map(r => `${r.booking_date} ${r.slot}`))); });
    return () => { alive = false; };
  }, [supabase, e.id, days, version]);

  const daySlots = slots[e.id]?.[days[day].getDay()] ?? [];
  const isTaken = (s: string) => booked?.has(`${ymd(days[day])} ${s}`) ?? true;

  async function confirm() {
    if (!slot) return;
    setBusy(true);
    const ok = await addBooking({ expertId: e.id, date: ymd(days[day]), slot, kind, share });
    setBusy(false);
    if (ok === 'taken') { setSlot(null); setVersion(v => v + 1); }
    else if (ok) { openDialog(null); toast(tr('Захиалга баталгаажлаа ✓ Имэйлээр мэдэгдэл очно.')); }
  }

  return (
    <>
      <Title>{e.name}</Title>
      <DialogDescription>{tr(e.title)} · {e.price.toLocaleString()}₮</DialogDescription>
      <div className="mt-4 mb-3.5">
        <b className="text-sm">{tr('Өдөр сонгох')}</b>
        <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {days.map((d, i) => (
            <button key={i} onClick={() => { setDay(i); setSlot(null); }}
              className={cn('w-15 flex-none rounded-xl border-[1.5px] py-2 text-center text-[.78rem]', day === i && 'border-primary bg-primary text-primary-foreground')}>
              {tr(WD_SHORT[d.getDay()])}<b className="block text-lg">{d.getDate()}</b>
            </button>
          ))}
        </div>
      </div>
      <div className="mb-3.5">
        <b className="text-sm">{tr('Цаг сонгох')}</b>
        {daySlots.length ? (
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {daySlots.map(s => (
              <button key={s} disabled={isTaken(s)} onClick={() => setSlot(s)}
                className={cn('min-h-11 rounded-xl border-[1.5px] disabled:line-through disabled:opacity-35', slot === s && 'border-primary bg-primary text-primary-foreground')}>{s}</button>
            ))}
          </div>
        ) : <p className="mt-1.5 text-sm text-muted-foreground">{tr('Энэ өдөр чөлөөт цаг алга. Өөр өдөр сонгоно уу.')}</p>}
      </div>
      <div className="mb-3.5">
        <b className="text-sm">{tr('Уулзалтын хэлбэр')}</b>
        <Segmented full className="mt-1.5" value={kind} onChange={setKind} options={[['video', tr('🎥 Видео')], ['chat', tr('💬 Чат')]]} />
      </div>
      <label className="mb-3.5 flex items-center gap-2.5 text-sm">
        <input type="checkbox" className="size-5 flex-none accent-primary" checked={share} onChange={ev => setShare(ev.target.checked)} />
        {tr('Сүүлийн 30 хоногийн mood тайлангаа сэтгэл зүйчтэй хуваалцах')}
      </label>
      <Button size="xl" className="w-full" disabled={!slot || busy} onClick={confirm}>{tr('Захиалга баталгаажуулах')}</Button>
    </>
  );
}
