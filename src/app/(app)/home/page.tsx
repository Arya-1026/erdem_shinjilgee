'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Botgo3D } from '@/components/botgo-3d';
import { DassReminder } from '@/components/dass-reminder';
import { FriendsMoods } from '@/components/friends-moods';
import { DailySupportCard } from '@/components/daily-support';
import { MoodCarousel } from '@/components/mood-carousel';
import { MoodFace } from '@/components/mood-face';
import { useApp } from '@/components/providers/app-provider';
import { RecTile } from '@/components/rec-tiles';
import { SeasonalGreeting } from '@/components/seasonal';
import { Segmented, Chip } from '@/components/segmented';
import { Eq } from '@/components/player';
import { usePlayer, songTrack } from '@/components/providers/player-provider';
import { usePlay, useSongRecs } from '@/components/use-play';
import { Button, buttonVariants } from '@/components/ui/button';
import { needsExpert, prediction, todaysEntries } from '@/lib/analytics';
import { MOOD_CAP, MOODS, TAGS, WD, moodById } from '@/lib/data';
import { scoredRecs } from '@/lib/recs';
import { cn } from '@/lib/utils';
import type { MusicKind } from '@/lib/music-suggest';
import type { Entry, Mood, RecType } from '@/lib/types';
import { useT } from '@/components/providers/locale-provider';

export default function HomePage() {
  const tr = useT();
  const { profile, entries, activeMood } = useApp();
  const [d] = useState(() => new Date());
  const [moodIdx, setMoodIdx] = useState(() => MOODS.findIndex(m => m.id === activeMood.id));
  const p = prediction(entries, profile.hobbies[0], tr);
  const todays = todaysEntries(entries);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-muted-foreground">{tr('{0} гараг, {1}-р сарын {2}', tr(WD[d.getDay()]), d.getMonth() + 1, d.getDate())}</p>
          <h2 className="text-[1.4rem] font-bold">{tr('Сайн уу, {0} 👋', profile.name)}</h2>
        </div>
        <TodayStatus entries={todays} />
      </div>
      <SeasonalGreeting />
      <FriendsMoods />
      <DassReminder />
      <div className="mt-4 grid gap-4 desk:grid-cols-[3fr_2fr] desk:items-start">
        <CheckinCard moodIdx={moodIdx} setMoodIdx={setMoodIdx} />
        <div className="flex min-w-0 flex-col gap-4">
          {needsExpert(entries) && (
            <section className="card-x grad-dawn border-0">
              <h3 className="mb-1 font-semibold">{tr('Сүүлийн өдрүүд хэцүү байна уу? 💜')}</h3>
              <p className="mb-2 text-sm">{tr('Мэргэжлийн хүнтэй ярилцах нь их тус болдог. Эхний 15 минутын зөвлөгөө үнэгүй.')}</p>
              <Link href="/experts" className={buttonVariants({ size: 'xl' })}>{tr('Сэтгэл зүйч харах')}</Link>
            </section>
          )}
          <DailySupportCard />
          <section className={cn('card-x border-l-4 border-l-primary', p.level === 'low' && 'border-l-warn', p.level === 'high' && 'border-l-ok')}>
            <div className="text-sm text-muted-foreground">{tr('🔮 Урьдчилсан таамаг')}</div>
            <h3 className="mb-1 font-semibold">{p.title}</h3>
            <p className="text-sm">{p.text}</p>
          </section>
          <HomeRecs m={MOODS[moodIdx]} />
        </div>
      </div>
    </>
  );
}

/* Нэрний хажууд: өнөөдөр бүртгэсэн эсэх. Бүртгэсэн бол сүүлийнхийг, дарвал бүгдийг харуулна. */
function TodayStatus({ entries }: { entries: Entry[] }) {
  const tr = useT();
  if (!entries.length) return (
    <div className="flex items-center gap-2 rounded-2xl border border-dashed bg-card/60 px-3.5 py-2 text-sm">
      <span className="text-lg">📝</span>
      <span><b className="block">{tr('Өнөөдрийн бүртгэл хийгээгүй байна')}</b><span className="text-muted-foreground">{tr('Доороос сэтгэл хөдлөлөө сонгоорой')}</span></span>
    </div>
  );
  // todaysEntries шинэ нь эхэндээ байдаг
  const last = entries[0], m = moodById(last.mood);
  return (
    <details className="group relative max-w-full rounded-2xl border bg-card/80 px-3.5 py-2 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2.5">
        <MoodFace m={m} className="size-8 text-[1.5rem]" />
        <span className="min-w-0">
          <span className="block text-xs text-muted-foreground">{tr('Өнөөдөр бүртгэсэн ✓')}{entries.length > 1 && tr(' · {0} удаа', entries.length)}</span>
          <b>{tr(m.label)}</b> <span className="text-muted-foreground">{tr('· {0} · эрч хүч {1}/5', last.entry_time.slice(0, 5), last.intensity)}</span>
        </span>
        <span className="ml-1 text-muted-foreground transition group-open:rotate-180" aria-hidden>⌄</span>
      </summary>
      <div className="mt-2 border-t pt-1">
        {entries.map(e => {
          const em = moodById(e.mood);
          return (
            <div key={e.id} className="flex items-start gap-2.5 border-b py-2 last:border-0">
              <MoodFace m={em} className="size-7 text-[1.3rem]" />
              <div className="min-w-0 flex-1">
                <b>{tr(em.label)}</b> <span className="text-muted-foreground">{tr('· {0} · эрч хүч {1}/5', e.entry_time.slice(0, 5), e.intensity)}</span>
                {e.tags.length > 0 && <div className="text-muted-foreground">{e.tags.map(t => tr(t)).join(', ')}</div>}
                {e.note && <div className="[overflow-wrap:anywhere]">{e.note}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </details>
  );
}

function CheckinCard({ moodIdx, setMoodIdx }: { moodIdx: number; setMoodIdx: (i: number) => void }) {
  const tr = useT();
  const { profile, updateProfile, addEntry, setTint, openDialog } = useApp();
  const [touched, setTouched] = useState(false);
  const [intensity, setIntensity] = useState(3);
  const [tags, setTags] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [custom, setCustom] = useState('');
  const [sleep, setSleep] = useState(7);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const m = MOODS[moodIdx];

  const onChange = useCallback((i: number, byUser: boolean) => {
    setMoodIdx(i);
    if (byUser) {
      navigator.vibrate?.(8); // Android дээр бага зэрэг чичирнэ
      setTouched(true);
    }
  }, [setMoodIdx]);

  // Хуудасны дэвсгэр сонгож буй mood-ийн өнгөөр зөөлөн будагдана
  useEffect(() => { setTint(m.color); }, [m.color, setTint]);

  // Жагсаалтад байхгүй шалтгааныг өөрөө бичиж нэмнэ (жишээ нь «Шалгалт»)
  function addCustom() {
    const t = custom.trim().replace(/\s+/g, ' ');
    if (!t) return;
    setTags(s => (s.some(x => x.toLowerCase() === t.toLowerCase()) ? s : [...s, t]));
    setCustom(''); setAdding(false);
  }

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
        <h2 className="text-[1.15rem] font-bold">{tr('Өнөөдөр ямар байна?')}</h2>
        <Segmented label={tr('Дүрсний төрөл')} className="bg-card/70" value={profile.art_mode} onChange={v => updateProfile({ art_mode: v })}
          options={[['emoji', '😊 Emoji'], ['art', '🎨 2D']]} />
      </div>
      {!touched && <p className="nudge-x m-0 text-center text-[.8rem] text-muted-foreground">{tr('👆 Хажуу тийш гүйлгээд сонгоорой →')}</p>}
      <MoodCarousel index={moodIdx} onChange={onChange} />
      <p key={m.id} className="fade-up mb-3.5 min-h-[1.5em] text-center font-semibold">{tr(MOOD_CAP[m.id])}</p>
      {/* Өнөөдрийн сэтгэл санаанд тохирсон 3D дүр (хэрэглэгчийн сонгосон амьтан): хүрч, эргүүлж болно */}
      <Botgo3D mood={m.id} className="mb-3.5 h-[320px]" />

      <Range id="int" label={<>{tr('Эрч хүч:')}{' '}<b>{intensity}</b> / 5</>} min={1} max={5} value={intensity} onChange={setIntensity} />
      <div className="mb-3.5">
        <div className="mb-1.5 text-sm font-semibold">{tr('Юутай холбоотой вэ?')}</div>
        <div className="flex flex-wrap gap-2">
          {TAGS.map(t => <Chip key={t} on={tags.includes(t)} onClick={() => setTags(s => (s.includes(t) ? s.filter(x => x !== t) : [...s, t]))}>{tr(t)}</Chip>)}
          {tags.filter(t => !TAGS.includes(t)).map(t => <Chip key={t} on aria-label={tr('{0} хасах', t)} onClick={() => setTags(s => s.filter(x => x !== t))}>{t} ✕</Chip>)}
          {!adding && <Chip onClick={() => setAdding(true)}>{tr('＋ Нэмэлт')}</Chip>}
        </div>
        {adding && (
          <form className="mt-2 flex gap-2" onSubmit={e => { e.preventDefault(); addCustom(); }}>
            <input autoFocus aria-label={tr('Нэмэлт шалтгаан')} placeholder={tr('Жишээ нь: Шалгалт')} value={custom} maxLength={30}
              onChange={e => setCustom(e.target.value)} onKeyDown={e => { if (e.key === 'Escape') { setAdding(false); setCustom(''); } }}
              className="min-h-10 min-w-0 flex-1 rounded-xl border-[1.5px] bg-background px-3 focus:border-primary focus:outline-none" />
            <Button type="submit" size="xl" variant="secondary" className="h-10 flex-none" disabled={!custom.trim()}>{tr('Нэмэх')}</Button>
            <Button type="button" size="xl" variant="ghost" className="h-10 flex-none" onClick={() => { setAdding(false); setCustom(''); }}>{tr('Болих')}</Button>
          </form>
        )}
      </div>
      <Range id="sl" label={<>{tr('Өнгөрсөн шөнө унтсан:')}{' '}<b>{sleep}</b>{' '}{tr('цаг')}</>} min={0} max={12} step={0.5} value={sleep} onChange={setSleep} />
      <div className="mb-3.5 flex flex-col gap-1.5">
        <label htmlFor="note" className="text-sm font-semibold">{tr('Тэмдэглэл')}{' '}<span className="font-normal text-muted-foreground">{tr('(заавал биш)')}</span></label>
        <textarea id="note" rows={3} placeholder={tr('Өнөөдөр юу болов?')} value={note} onChange={e => setNote(e.target.value)} maxLength={2000}
          className="min-h-12 w-full resize-y rounded-xl border-[1.5px] bg-background px-3.5 py-3 focus:border-primary focus:outline-none" />
      </div>
      <Button size="xl" className="w-full" disabled={saving} onClick={save}>{saving ? tr('Хадгалж байна…') : tr('Хадгалах')}</Button>
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

const ROWS: [RecType, string][] = [['exercise', '🧘 Хийх'], ['movie', '🎬 Үзэх']];

// «Танд зориулав»: carousel дээр сонгосон mood-оор шууд шинэчлэгдэнэ
function HomeRecs({ m }: { m: Mood }) {
  const tr = useT();
  const { profile, feedback, music } = useApp();
  const play = usePlay();
  const recs = scoredRecs(m, profile.hobbies, feedback);
  return (
    <section className="card-x" aria-live="polite">
      <div className="flex items-center justify-between">
        <h3 className="m-0 font-semibold">{tr('«{0}» үед танд ✨', tr(m.label))}</h3>
        <Link href="/recs" className="text-sm font-semibold text-primary">{tr('Бүгд →')}</Link>
      </div>
      <Button size="xl" className="mt-2.5 w-full text-[#2B2724]" style={{ background: m.color }} onClick={() => play.mood(m.id)}>{tr('▶ «{0}» playlist тоглуулах', tr(m.label))}</Button>
      {/* Дуу: зөвхөн AI тухайн хүнд сонгосон дуунууд + тайвшруулах ая */}
      {music.discovery && (
        <>
          <ForYouRow title={tr('🎵 Сонсох')} m={m} kind="song" />
          <ForYouRow title={tr('🎼 Тайвшрах ая')} m={m} kind="ambient" />
        </>
      )}
      {ROWS.map(([type, title]) => {
        const list = recs.filter(r => r.type === type);
        return list.length > 0 && (
          <div key={type}>
            <div className="mt-3.5 mb-2 text-sm font-bold">{tr(title)}</div>
            <div className="hscroll">{list.map(r => <RecTile key={r.id} r={r} m={m} />)}</div>
          </div>
        );
      })}
    </section>
  );
}

function ForYouRow({ title, m, kind }: { title: string; m: Mood; kind: MusicKind }) {
  const tr = useT();
  const { recs } = useSongRecs(m.id, kind);
  const { nowId, playing } = usePlayer();
  const play = usePlay();
  const tracks = (recs ?? []).map(r => songTrack(r, m.id));
  return (
    <div>
      <div className="mt-3.5 mb-2 text-sm font-bold">{title} <span className="font-normal text-muted-foreground">{tr('· танд зориулсан')}</span></div>
      {recs === null ? <p className="text-sm text-muted-foreground">{tr('🎧 Сонгож байна…')}</p> : !tracks.length ? <p className="text-sm text-muted-foreground">{tr('Дуу олдсонгүй.')}</p> : (
        <div className="hscroll">
          {tracks.map((t, i) => (
            <button key={t.id} onClick={() => play.list(tracks, i)} className={cn('htile flex w-[132px] flex-none snap-start flex-col self-start text-left', nowId === t.id && 'now')}>
              <div className="relative mb-1.5 size-[132px] overflow-hidden rounded-xl bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- Spotify CDN-ийн зураг */}
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
