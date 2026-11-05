'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MoodFace } from '@/components/mood-face';
import { useApp } from '@/components/providers/app-provider';
import { RecCard } from '@/components/rec-tiles';
import { Chip } from '@/components/segmented';
import { ForYou, LikedSongs, MusicLibrary } from '@/components/music';
import { MOODS, moodById } from '@/lib/data';
import { scoredRecs } from '@/lib/recs';
import { cn } from '@/lib/utils';
import type { MoodId, RecType } from '@/lib/types';

type Tab = 'all' | RecType | 'song';
const TABS: [Tab, string][] = [['all', 'Бүгд'], ['exercise', '🧘 Дасгал'], ['song', '🎵 Дуу'], ['movie', '🎬 Кино']];

// /api/{youtube,spotify}/login, callback-аас буцаж ирэх үеийн мэдэгдэл
const CONNECT_MSG = (name: string, env: string, users: string): Record<string, string> => ({
  'not-configured': `${name} тохируулагдаагүй байна (${env}).`,
  'wrong-host': `${name} холбохын тулд апп-ыг NEXT_PUBLIC_APP_URL хаягаар (локалд http://127.0.0.1:3000) нээнэ үү.`,
  state: 'Аюулгүй байдлын шалгалт амжилтгүй. Дахин оролдоно уу.',
  denied: `${name} холболтыг цуцаллаа. ${users}`,
  'not-allowlisted': users,
  error: `${name} холбоход алдаа гарлаа.`,
});
const MSG = {
  youtube: CONNECT_MSG('YouTube', 'GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY', 'Туршилтын горимд таны Google бүртгэл OAuth consent screen → Test users-д нэмэгдсэн байх ёстой.'),
  spotify: CONNECT_MSG('Spotify', 'SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY', 'Таны Spotify бүртгэл энэ апп-ын хэрэглэгчийн жагсаалтад алга (Spotify Dashboard → User Management).'),
};

export default function RecsPage() {
  const { profile, feedback, activeMood: saved, setFeedback, musicSync, music } = useApp();
  // Өөр mood-ын зөвлөмжийг зөвхөн энэ хуудсанд урьдчилан харна; хуудаснаас гарахад сүүлийн бүртгэл рүүгээ буцна
  const [picked, setPicked] = useState<MoodId | null>(null);
  const cm = picked ? moodById(picked) : saved;
  const preview = cm.id !== saved.id;
  const [tab, setTab] = useState<Tab>('all');
  const list = scoredRecs(cm, profile.hobbies, feedback).filter(x => tab === 'all' || x.type === tab);
  const params = useSearchParams(), router = useRouter(), path = usePathname();

  useEffect(() => {
    const p = params.has('youtube') ? 'youtube' : params.has('spotify') ? 'spotify' : null;
    const s = p && params.get(p); if (!p || !s) return;
    router.replace(path, { scroll: false });
    // Холбогдсон даруйд дуунуудыг татаж ангилна
    if (s === 'connected') { toast.success(`${p === 'youtube' ? 'YouTube' : 'Spotify'} холбогдлоо 🎧`); void musicSync(p); }
    else toast.error(MSG[p][s] ?? MSG[p].error, { duration: 8000 });
  }, [params, router, path, musicSync]);

  const onFeedback = (id: string, v: number) => {
    setFeedback(id, feedback[id] === v ? 0 : v);
    toast(v === 1 ? 'Баярлалаа! Илүү ойролцоо санал болгоно 👍' : 'Ойлголоо, үүнийг дахин санал болгохгүй');
  };

  return (
    <>
      <section className="card-x checkin mb-3.5 flex items-center gap-3.5" style={{ '--mc': cm.color } as React.CSSProperties}>
        <MoodFace m={cm} className="size-14 text-[2.6rem]" />
        <div>
          <div className="text-sm text-muted-foreground">{preview ? 'Урьдчилан харж байна' : 'Сүүлийн бүртгэл'}</div>
          <b>{cm.label}</b>
          <div className="text-sm text-muted-foreground">Сонирхол: {profile.hobbies.slice(0, 3).join(', ')}{profile.hobbies.length > 3 ? '…' : ''}</div>
        </div>
        {preview && <button className="ml-auto self-start text-sm font-semibold text-primary" onClick={() => setPicked(null)}>↺ {saved.emoji} {saved.label} руу буцах</button>}
      </section>

      <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar" aria-label="Сэтгэл хөдлөл солих">
        {MOODS.map(m => (
          // Design system «Mood chips»: өнгөтэй дэвсгэр, сонгосон нь ink хүрээтэй
          <Chip key={m.id} onClick={() => setPicked(m.id)} style={{ background: m.color }}
            className={cn('border-2 border-transparent font-semibold text-[#2B2724] hover:border-foreground/30', m.id === cm.id && 'border-foreground hover:border-foreground')} aria-pressed={m.id === cm.id}>
            {m.emoji} {m.label}
          </Chip>
        ))}
      </div>

      {/* Legacy-ийн дараалал: эхлээд дасгал, дуу, киноны зөвлөмж, дараа нь хөгжим */}
      <div className="mb-3.5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {TABS.map(([k, l]) => <Chip key={k} on={tab === k} onClick={() => setTab(k)}>{l}</Chip>)}
      </div>
      {tab !== 'song' && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3">
          {list.length ? list.map(x => <RecCard key={x.id} r={x} m={cm} onFeedback={onFeedback} />) : <p className="text-muted-foreground">Энэ төрөлд зөвлөмж олдсонгүй.</p>}
        </div>
      )}

      {(tab === 'all' || tab === 'song') && (
        <>
          <h2 className="mt-5 mb-2 text-[1.15rem] font-bold">🎧 Танд зориулсан дуу</h2>
          {music.discovery ? <ForYou mood={cm} /> : <p className="card-x text-sm text-muted-foreground">Дуу санал болгохын тулд .env.local-д YOUTUBE_API_KEY тохируулна уу (README → YouTube).</p>}
          <div className="mt-3 flex flex-col gap-3">
            <LikedSongs mood={cm} />
            <MusicLibrary provider="youtube" mood={cm} />
            <MusicLibrary provider="spotify" mood={cm} />
          </div>
        </>
      )}
    </>
  );
}
