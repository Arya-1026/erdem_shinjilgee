'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { SupportBody } from '@/components/daily-support';
import { ExerciseCoach } from '@/components/exercise/coach';
import { MoodFace } from '@/components/mood-face';
import { Poster } from '@/components/poster';
import { useApp, type DialogState } from '@/components/providers/app-provider';
import { Segmented } from '@/components/segmented';
import { usePlay } from '@/components/use-play';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { RECS, WD_SHORT, moodById } from '@/lib/data';
import { addDays, ymd } from '@/lib/date';
import { cn } from '@/lib/utils';

// Гар утсан дээр доороос гарч ирэх sheet, том дэлгэцэн дээр голд
const SHEET = 'top-auto bottom-0 left-0 max-h-[92dvh] max-w-full translate-x-0 translate-y-0 gap-0 overflow-auto rounded-t-[22px] rounded-b-none px-[18px] pt-[22px] pb-[calc(22px+var(--safe-b))] text-base ring-0 max-sm:data-open:zoom-in-100 max-sm:data-open:slide-in-from-bottom-10 max-sm:data-closed:zoom-out-100 max-sm:data-closed:slide-out-to-bottom-10 sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:max-w-[520px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[22px] sm:p-[26px]';

export function DialogHost() {
  const { dialog, openDialog } = useApp();
  // Хаах animation дуусах хүртэл сүүлийн агуулгыг хадгална
  const [shown, setShown] = useState<DialogState>(dialog);
  if (dialog && dialog !== shown) setShown(dialog);
  const d = dialog ?? shown;
  return (
    <Dialog open={Boolean(dialog)} onOpenChange={o => { if (!o) openDialog(null); }}>
      <DialogContent className={SHEET}>
        {d?.kind === 'saved' && <Saved mood={d.mood} />}
        {d?.kind === 'exercise' && <Exercise recId={d.recId} />}
        {d?.kind === 'breath' && <Exercise recId="e1" />}
        {d?.kind === 'movie' && <Movie recId={d.recId} moodId={d.mood} />}
        {d?.kind === 'book' && <Book key={d.expertId} expertId={d.expertId} />}
      </DialogContent>
    </Dialog>
  );
}

const Title = ({ children, className }: { children: React.ReactNode; className?: string }) =>
  <DialogTitle className={cn('mb-2 pr-11 text-[1.15rem] leading-tight font-bold', className)}>{children}</DialogTitle>;

function Saved({ mood }: { mood: Parameters<typeof moodById>[0] }) {
  const { openDialog } = useApp();
  const play = usePlay();
  const router = useRouter();
  const m = moodById(mood);
  const go = (href: string) => { openDialog(null); router.push(href); };
  return (
    <>
      <div className="text-center">
        <MoodFace m={m} className="mx-auto mb-2.5 size-22 text-[4rem]" />
        <Title className="pr-0">Бүртгэгдлээ!</Title>
        <DialogDescription className="text-sm">Таны өнөөдрийн бүртгэлд тулгуурласан дэмжлэг</DialogDescription>
      </div>
      <div className="mt-3 rounded-2xl bg-secondary/60 p-3.5">
        <SupportBody compact />
      </div>
      <div className="mt-4 flex flex-col gap-2.5">
        {['anxious', 'angry', 'sad'].includes(m.id) && <Button size="xl" onClick={() => openDialog({ kind: 'breath' })}>🫁 Амьсгалын дасгал хийх</Button>}
        <Button size="xl" className="bg-spotify hover:bg-spotify/85" onClick={() => { openDialog(null); play.mood(m.id); }}>▶ Тохирох дуу сонсох</Button>
        <Button size="xl" variant="secondary" onClick={() => go('/recs')}>✨ Зөвлөмж харах</Button>
        <Button size="xl" variant="outline" onClick={() => go('/chat')}>💬 AI-тай ярилцах</Button>
      </div>
    </>
  );
}

function Exercise({ recId }: { recId: string }) {
  const { openDialog, bumpExercises } = useApp();
  const r = RECS.find(x => x.id === recId)!;
  const finish = () => { bumpExercises(); openDialog(null); toast('Сайн байна! Дасгал бүртгэгдлээ 🎉'); };
  return (
    <>
      <Title>{r.title}</Title>
      <DialogDescription>{r.sub}</DialogDescription>
      {r.moves ? <ExerciseCoach moves={r.moves} onFinish={finish} /> : (
        <>
          <ol className="mt-2 list-decimal pl-5">{r.steps?.map(s => <li key={s} className="mb-2">{s}</li>)}</ol>
          <Button size="xl" className="mt-4 w-full" onClick={finish}>✓ Дууслаа</Button>
        </>
      )}
    </>
  );
}

function Movie({ recId, moodId }: { recId: string; moodId: Parameters<typeof moodById>[0] }) {
  const { openDialog, watchlist, toggleWatch, setFeedback, profile } = useApp();
  const r = RECS.find(x => x.id === recId)!, m = moodById(moodId);
  const hob = (r.hobby || []).some(h => profile.hobbies.includes(h));
  const soothing = ['sad', 'anxious', 'tired', 'angry'].includes(m.id);
  return (
    <>
      <div className="tile-cover -mt-1 mb-3.5 grid h-[230px] place-items-center rounded-[18px] py-3 text-6xl" style={{ '--tc': moodById(r.moods[0]).color } as React.CSSProperties}>
        <Poster src={r.poster} title={r.title} className="h-full rounded-xl shadow-[0_8px_24px_rgba(0,0,0,.35)]" />
      </div>
      <Title>{r.title}</Title>
      <DialogDescription className="mb-2">{r.sub}</DialogDescription>
      <p className="mb-3">{r.desc}</p>
      <div className="rounded-[18px] bg-secondary p-3">
        <b className="text-sm">💡 Яагаад санал болгож байна вэ?</b>
        <p className="mt-1 text-sm">«{m.label}» мэдрэмжтэй үед энэ кино {soothing ? 'сэтгэлийг тайвшруулж, дулаахан мэдрэмж төрүүлдэг' : 'эерэг эрч хүчийг тань улам нэмэгдүүлдэг'}.{hob && ' Мөн таны хоббид тохирсон.'}</p>
      </div>
      <div className="mt-4 flex flex-col gap-2.5">
        <Button size="xl" onClick={async () => { const added = await toggleWatch(r.id); openDialog(null); toast(added ? 'Үзэх жагсаалтад нэмэгдлээ 🎬' : 'Жагсаалтаас хасагдлаа'); }}>
          {watchlist.includes(r.id) ? '✓ Үзэх жагсаалтад байна' : '＋ Үзэх жагсаалтад нэмэх'}
        </Button>
        <Button size="xl" variant="outline" onClick={() => { setFeedback(r.id, 1); openDialog(null); toast('Баярлалаа! Илүү ойролцоо санал болгоно 👍'); }}>👍 Таалагдсан</Button>
      </div>
    </>
  );
}

function Book({ expertId }: { expertId: string }) {
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
    else if (ok) { openDialog(null); toast('Захиалга баталгаажлаа ✓ Имэйлээр мэдэгдэл очно.'); }
  }

  return (
    <>
      <Title>{e.name}</Title>
      <DialogDescription>{e.title} · {e.price.toLocaleString()}₮</DialogDescription>
      <div className="mt-4 mb-3.5">
        <b className="text-sm">Өдөр сонгох</b>
        <div className="mt-1.5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {days.map((d, i) => (
            <button key={i} onClick={() => { setDay(i); setSlot(null); }}
              className={cn('w-15 flex-none rounded-xl border-[1.5px] py-2 text-center text-[.78rem]', day === i && 'border-primary bg-primary text-white')}>
              {WD_SHORT[d.getDay()]}<b className="block text-lg">{d.getDate()}</b>
            </button>
          ))}
        </div>
      </div>
      <div className="mb-3.5">
        <b className="text-sm">Цаг сонгох</b>
        {daySlots.length ? (
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {daySlots.map(s => (
              <button key={s} disabled={isTaken(s)} onClick={() => setSlot(s)}
                className={cn('min-h-11 rounded-xl border-[1.5px] disabled:line-through disabled:opacity-35', slot === s && 'border-primary bg-primary text-white')}>{s}</button>
            ))}
          </div>
        ) : <p className="mt-1.5 text-sm text-muted-foreground">Энэ өдөр чөлөөт цаг алга. Өөр өдөр сонгоно уу.</p>}
      </div>
      <div className="mb-3.5">
        <b className="text-sm">Уулзалтын хэлбэр</b>
        <Segmented full className="mt-1.5" value={kind} onChange={setKind} options={[['video', '🎥 Видео'], ['chat', '💬 Чат']]} />
      </div>
      <label className="mb-3.5 flex items-center gap-2.5 text-sm">
        <input type="checkbox" className="size-5 flex-none accent-primary" checked={share} onChange={ev => setShare(ev.target.checked)} />
        Сүүлийн 30 хоногийн mood тайлангаа сэтгэл зүйчтэй хуваалцах
      </label>
      <Button size="xl" className="w-full" disabled={!slot || busy} onClick={confirm}>Захиалга баталгаажуулах</Button>
    </>
  );
}
