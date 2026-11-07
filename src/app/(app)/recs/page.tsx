'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { MoodFace } from '@/components/mood-face';
import { useApp } from '@/components/providers/app-provider';
import { RecCard } from '@/components/rec-tiles';
import { Chip } from '@/components/segmented';
import { ForYou, LikedSongs } from '@/components/music';
import { MOODS, moodById } from '@/lib/data';
import { scoredRecs } from '@/lib/recs';
import { useMovieRecs } from '@/components/use-movies';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MoodId, RecType } from '@/lib/types';
import { useT } from '@/components/providers/locale-provider';

type Tab = 'all' | RecType | 'song';
const TABS: [Tab, string][] = [['all', 'Бүгд'], ['exercise', '🧘 Дасгал'], ['song', '🎵 Дуу'], ['movie', '🎬 Кино']];

export default function RecsPage() {
  const tr = useT();
  const { profile, feedback, activeMood: saved, setFeedback, music } = useApp();
  // Өөр mood-ын зөвлөмжийг зөвхөн энэ хуудсанд урьдчилан харна; хуудаснаас гарахад сүүлийн бүртгэл рүүгээ буцна
  const [picked, setPicked] = useState<MoodId | null>(null);
  const cm = picked ? moodById(picked) : saved;
  const preview = cm.id !== saved.id;
  const [tab, setTab] = useState<Tab>('all');
  const { recs: movies, refresh: moreMovies } = useMovieRecs(cm.id, 12);
  const list = [...scoredRecs(cm, profile.hobbies, feedback), ...(movies ?? [])].filter(x => tab === 'all' || x.type === tab);

  const onFeedback = (id: string, v: number) => {
    setFeedback(id, feedback[id] === v ? 0 : v);
    toast(v === 1 ? tr('Баярлалаа! Илүү ойролцоо санал болгоно 👍') : tr('Ойлголоо, үүнийг дахин санал болгохгүй'));
  };

  return (
    <>
      <section className="card-x checkin mb-3.5 flex items-center gap-3.5" style={{ '--mc': cm.color } as React.CSSProperties}>
        <MoodFace m={cm} className="size-14 text-[2.6rem]" />
        <div>
          <div className="text-sm text-muted-foreground">{preview ? tr('Урьдчилан харж байна') : tr('Сүүлийн бүртгэл')}</div>
          <b>{tr(cm.label)}</b>
          <div className="text-sm text-muted-foreground">{tr('Сонирхол: {0}{1}', profile.hobbies.slice(0, 3).map(h => tr(h)).join(', '), profile.hobbies.length > 3 ? '…' : '')}</div>
        </div>
        {preview && <button className="ml-auto self-start text-sm font-semibold text-primary" onClick={() => setPicked(null)}>{tr('↺ {0} {1} руу буцах', saved.emoji, saved.label)}</button>}
      </section>

      <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar" aria-label={tr('Сэтгэл хөдлөл солих')}>
        {MOODS.map(m => (
          // Design system «Mood chips»: өнгөтэй дэвсгэр, сонгосон нь ink хүрээтэй
          <Chip key={m.id} onClick={() => setPicked(m.id)} style={{ background: m.color }}
            className={cn('border-2 border-transparent font-semibold text-[#2B2724] hover:border-foreground/30', m.id === cm.id && 'border-foreground hover:border-foreground')} aria-pressed={m.id === cm.id}>
            {m.emoji} {tr(m.label)}
          </Chip>
        ))}
      </div>

      {/* Legacy-ийн дараалал: эхлээд дасгал, дуу, киноны зөвлөмж, дараа нь хөгжим */}
      <div className="mb-3.5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {TABS.map(([k, l]) => <Chip key={k} on={tab === k} onClick={() => setTab(k)}>{tr(l)}</Chip>)}
      </div>
      {(tab === 'all' || tab === 'movie') && (
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">{tr('🎬 Кинонуудыг IMDb-ийн өндөр үнэлгээтэй кинонуудаас танд тааруулж сонгосон')}</span>
          <Button size="xl" variant="outline" className="h-10" disabled={!movies} onClick={moreMovies}>{tr('↻ Өөр кинонууд')}</Button>
        </div>
      )}
      {tab !== 'song' && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3">
          {list.length ? list.map(x => <RecCard key={x.id} r={x} m={cm} onFeedback={onFeedback} />) : <p className="text-muted-foreground">{tr('Энэ төрөлд зөвлөмж олдсонгүй.')}</p>}
        </div>
      )}

      {(tab === 'all' || tab === 'song') && (
        <>
          <h2 className="mt-5 mb-2 text-[1.15rem] font-bold">{tr('🎧 Танд зориулсан дуу')}</h2>
          {music.discovery ? <ForYou mood={cm} /> : <p className="card-x text-sm text-muted-foreground">{tr('Дуу санал болгохын тулд .env.local-д SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET тохируулна уу (README → Spotify).')}</p>}
          <div className="mt-3 flex flex-col gap-3">
            <LikedSongs mood={cm} />
          </div>
        </>
      )}
    </>
  );
}
