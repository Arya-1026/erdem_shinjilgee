'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { DailySupportCard } from '@/components/daily-support';
import { MoodCarousel } from '@/components/mood-carousel';
import { MoodFace } from '@/components/mood-face';
import { useApp } from '@/components/providers/app-provider';
import { RecTile } from '@/components/rec-tiles';
import { Segmented, Chip } from '@/components/segmented';
import { Eq } from '@/components/player';
import { usePlayer, ytTrack } from '@/components/providers/player-provider';
import { usePlay, useSongRecs } from '@/components/use-play';
import { Button, buttonVariants } from '@/components/ui/button';
import { needsExpert, prediction, todaysEntries } from '@/lib/analytics';
import { MOOD_CAP, MOODS, TAGS, WD, moodById } from '@/lib/data';
import { scoredRecs } from '@/lib/recs';
import { cn } from '@/lib/utils';
import type { MusicKind } from '@/lib/music-suggest';
import type { Mood, RecType } from '@/lib/types';

export default function HomePage() {
  const { profile, entries, activeMood } = useApp();
  const [d] = useState(() => new Date());
  const [moodIdx, setMoodIdx] = useState(() => MOODS.findIndex(m => m.id === activeMood.id));
  const p = prediction(entries, profile.hobbies[0]);
  const todays = todaysEntries(entries);

  return (
    <>
      <p className="text-muted-foreground">{WD[d.getDay()]} гараг, {d.getMonth() + 1}-р сарын {d.getDate()}</p>
      <h2 className="text-[1.4rem] font-bold">Сайн уу, {profile.name} 👋</h2>
      <div className="mt-4 grid gap-4 desk:grid-cols-[3fr_2fr] desk:items-start">
        <CheckinCard moodIdx={moodIdx} setMoodIdx={setMoodIdx} />
        <div className="flex min-w-0 flex-col gap-4">
          {needsExpert(entries) && (
            <section className="card-x grad-dawn border-0">
              <h3 className="mb-1 font-semibold">Сүүлийн өдрүүд хэцүү байна уу? 💜</h3>
              <p className="mb-2 text-sm">Мэргэжлийн хүнтэй ярилцах нь их тус болдог. Эхний 15 минутын зөвлөгөө үнэгүй.</p>
              <Link href="/experts" className={buttonVariants({ size: 'xl' })}>Сэтгэл зүйч харах</Link>
            </section>
          )}
          <DailySupportCard />
          <section className={cn('card-x border-l-4 border-l-primary', p.level === 'low' && 'border-l-warn', p.level === 'high' && 'border-l-ok')}>
            <div className="text-sm text-muted-foreground">🔮 Урьдчилсан таамаг</div>
            <h3 className="mb-1 font-semibold">{p.title}</h3>
            <p className="text-sm">{p.text}</p>
          </section>
          <HomeRecs m={MOODS[moodIdx]} />
          <section className="card-x">
            <h3 className="mb-1 font-semibold">Өнөөдрийн бүртгэл</h3>
            {todays.length ? todays.map(e => {
              const m = moodById(e.mood);
              return (
                <div key={e.id} className="flex items-center gap-3 border-b py-2.5 last:border-0">
                  <MoodFace m={m} className="size-9 text-[1.6rem]" />
                  <div className="min-w-0 flex-1">
                    <b>{m.label}</b> <span className="text-sm text-muted-foreground">· {e.entry_time} · эрчим {e.intensity}/5</span>
                    {e.tags.length > 0 && <div className="text-sm text-muted-foreground">{e.tags.join(', ')}</div>}
                    {e.note && <div className="text-sm">{e.note}</div>}
                  </div>
                </div>
              );
            }) : <p className="text-sm text-muted-foreground">Одоогоор бүртгэл алга. Дээрээс сэтгэл хөдлөлөө сонгоорой.</p>}
          </section>
        </div>
      </div>
    </>
  );
}

function CheckinCard({ moodIdx, setMoodIdx }: { moodIdx: number; setMoodIdx: (i: number) => void }) {
  const { profile, updateProfile, addEntry, setLiveMood, setTint, openDialog } = useApp();
  const [touched, setTouched] = useState(false);
  const [intensity, setIntensity] = useState(3);
  const [tags, setTags] = useState<string[]>([]);
  const [sleep, setSleep] = useState(7);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const m = MOODS[moodIdx];

  const onChange = useCallback((i: number, byUser: boolean) => {
    setMoodIdx(i);
    if (byUser) {
      setLiveMood(MOODS[i].id);
      navigator.vibrate?.(8); // Android дээр бага зэрэг чичирнэ
      setTouched(true);
    }
  }, [setMoodIdx, setLiveMood]);

  // Хуудасны дэвсгэр сонгож буй mood-ийн өнгөөр зөөлөн будагдана
  useEffect(() => { setTint(m.color); }, [m.color, setTint]);

  async function save() {
    setSaving(true);
    const e = await addEntry({ mood: m.id, intensity, tags, sleep, note: note.trim() });
    setSaving(false);
    if (!e) return;
    setIntensity(3); setTags([]); setNote(''); setSleep(7);
    openDialog({ kind: 'saved', mood: e.mood });
  }

  return (
    <section className="card-x checkin">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[1.15rem] font-bold">Өнөөдөр ямар байна?</h2>
        <Segmented label="Дүрсний төрөл" className="bg-card/70" value={profile.art_mode} onChange={v => updateProfile({ art_mode: v })}
          options={[['emoji', '😊 Emoji'], ['art', '🎨 2D']]} />
      </div>
      {!touched && <p className="nudge-x m-0 text-center text-[.8rem] text-muted-foreground">👆 Хажуу тийш гүйлгээд сонгоорой →</p>}
      <MoodCarousel index={moodIdx} onChange={onChange} />
      <p key={m.id} className="fade-up mb-3.5 min-h-[1.5em] text-center font-semibold">{MOOD_CAP[m.id]}</p>

      <Range id="int" label={<>Эрчим: <b>{intensity}</b> / 5</>} min={1} max={5} value={intensity} onChange={setIntensity} />
      <div className="mb-3.5">
        <div className="mb-1.5 text-sm font-semibold">Юутай холбоотой вэ?</div>
        <div className="flex flex-wrap gap-2">
          {TAGS.map(t => <Chip key={t} on={tags.includes(t)} onClick={() => setTags(s => (s.includes(t) ? s.filter(x => x !== t) : [...s, t]))}>{t}</Chip>)}
        </div>
      </div>
      <Range id="sl" label={<>Өнгөрсөн шөнө унтсан: <b>{sleep}</b> цаг</>} min={0} max={12} step={0.5} value={sleep} onChange={setSleep} />
      <div className="mb-3.5 flex flex-col gap-1.5">
        <label htmlFor="note" className="text-sm font-semibold">Тэмдэглэл <span className="font-normal text-muted-foreground">(заавал биш)</span></label>
        <textarea id="note" rows={3} placeholder="Өнөөдөр юу болов?" value={note} onChange={e => setNote(e.target.value)} maxLength={2000}
          className="min-h-12 w-full resize-y rounded-xl border-[1.5px] bg-background px-3.5 py-3 focus:border-primary focus:outline-none" />
      </div>
      <Button size="xl" className="w-full" disabled={saving} onClick={save}>{saving ? 'Хадгалж байна…' : 'Хадгалах'}</Button>
    </section>
  );
}

function Range({ id, label, value, onChange, ...p }: { id: string; label: React.ReactNode; value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) {
  return (
    <div className="mb-3.5 flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <input id={id} type="range" className="h-8 w-full accent-primary" value={value} onChange={e => onChange(+e.target.value)} {...p} />
    </div>
  );
}

const ROWS: [RecType, string][] = [['song', '🎵 Сонсох'], ['exercise', '🧘 Хийх'], ['movie', '🎬 Үзэх']];

// «Танд зориулав»: carousel дээр сонгосон mood-оор шууд шинэчлэгдэнэ
function HomeRecs({ m }: { m: Mood }) {
  const { profile, feedback, music } = useApp();
  const play = usePlay();
  const recs = scoredRecs(m, profile.hobbies, feedback);
  return (
    <section className="card-x" aria-live="polite">
      <div className="flex items-center justify-between">
        <h3 className="m-0 font-semibold">«{m.label}» үед танд ✨</h3>
        <Link href="/recs" className="text-sm font-semibold text-primary">Бүгд →</Link>
      </div>
      <Button size="xl" className="mt-2.5 w-full text-[#2B2724]" style={{ background: m.color }} onClick={() => play.mood(m.id)}>▶ «{m.label}» playlist тоглуулах</Button>
      {ROWS.map(([type, title]) => {
        // Дуу: YouTube хайлт тохируулсан бол AI тухайн хүнд сонгосон дуунууд + тайвшруулах ая
        if (type === 'song' && music.discovery) return (
          <div key={type}>
            <ForYouRow title={title} m={m} kind="song" />
            <ForYouRow title="🎼 Тайвшрах ая" m={m} kind="ambient" />
          </div>
        );
        const list = recs.filter(r => r.type === type);
        return list.length > 0 && (
          <div key={type}>
            <div className="mt-3.5 mb-2 text-sm font-bold">{title}</div>
            <div className="hscroll">{list.map(r => <RecTile key={r.id} r={r} m={m} />)}</div>
          </div>
        );
      })}
    </section>
  );
}

function ForYouRow({ title, m, kind }: { title: string; m: Mood; kind: MusicKind }) {
  const { recs } = useSongRecs(m.id, kind);
  const { nowId, playing } = usePlayer();
  const play = usePlay();
  const tracks = (recs ?? []).map(r => ytTrack(r, m.id));
  return (
    <div>
      <div className="mt-3.5 mb-2 text-sm font-bold">{title} <span className="font-normal text-muted-foreground">· танд зориулсан</span></div>
      {recs === null ? <p className="text-sm text-muted-foreground">🎧 Сонгож байна…</p> : !tracks.length ? <p className="text-sm text-muted-foreground">Дуу олдсонгүй.</p> : (
        <div className="hscroll">
          {tracks.map((t, i) => (
            <button key={t.id} onClick={() => play.list(tracks, i)} className={cn('htile flex w-[132px] flex-none snap-start flex-col self-start text-left', nowId === t.id && 'now')}>
              <div className="relative mb-1.5 h-[74px] w-[132px] overflow-hidden rounded-xl bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- YouTube CDN-ийн зураг */}
                {t.image && <img src={t.image} alt="" className="size-full object-cover" loading="lazy" />}
                <span className="pl absolute right-1.5 bottom-1.5 grid size-[30px] place-items-center rounded-full bg-black/70 text-xs text-white">{nowId === t.id && playing ? <Eq /> : '▶'}</span>
              </div>
              <b className={cn('line-clamp-2 text-sm leading-tight', nowId === t.id && 'text-spotify')}>{t.title}</b>
              <span className="block truncate text-xs text-muted-foreground">{t.artist}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
