'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { MoodFace } from '@/components/mood-face';
import { useApp } from '@/components/providers/app-provider';
import { RecCard } from '@/components/rec-tiles';
import { Chip } from '@/components/segmented';
import { ForYou, MusicLibrary } from '@/components/music';
import { Button } from '@/components/ui/button';
import { usePlay } from '@/components/use-play';
import { MOODS } from '@/lib/data';
import { scoredRecs } from '@/lib/recs';
import { cn } from '@/lib/utils';
import type { RecType } from '@/lib/types';

const TABS: ['all' | RecType, string][] = [['all', 'Бүгд'], ['exercise', '🧘 Дасгал'], ['song', '🎵 Дуу'], ['movie', '🎬 Кино']];

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
  const { profile, feedback, activeMood: cm, setLiveMood, setFeedback, musicSync, music } = useApp();
  const [tab, setTab] = useState<'all' | RecType>('all');
  const list = scoredRecs(cm, profile.hobbies, feedback).filter(r => tab === 'all' || r.type === tab);
  const params = useSearchParams(), router = useRouter(), path = usePathname();
  const play = usePlay();

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
          <div className="text-sm text-muted-foreground">Одоогийн сэтгэл хөдлөл</div>
          <b>{cm.label}</b>
          <div className="text-sm text-muted-foreground">Сонирхол: {profile.hobbies.slice(0, 3).join(', ')}{profile.hobbies.length > 3 ? '…' : ''}</div>
        </div>
      </section>

      <div className="mb-3 flex gap-2 overflow-x-auto no-scrollbar" aria-label="Сэтгэл хөдлөл солих">
        {MOODS.map(m => (
          // Design system «Mood chips»: өнгөтэй дэвсгэр, сонгосон нь ink хүрээтэй
          <Chip key={m.id} onClick={() => setLiveMood(m.id)} style={{ background: m.color }}
            className={cn('border-2 border-transparent font-semibold text-[#2B2724] hover:border-foreground/30', m.id === cm.id && 'border-foreground hover:border-foreground')} aria-pressed={m.id === cm.id}>
            {m.emoji} {m.label}
          </Chip>
        ))}
      </div>

      {/* Legacy-ийн дараалал: эхлээд дасгал, дуу, киноны зөвлөмж, дараа нь хөгжим */}
      <div className="mb-3.5 flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {TABS.map(([k, l]) => <Chip key={k} on={tab === k} onClick={() => setTab(k)}>{l}</Chip>)}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3">
        {list.length ? list.map(r => <RecCard key={r.id} r={r} m={cm} onFeedback={onFeedback} />) : <p className="text-muted-foreground">Энэ төрөлд зөвлөмж олдсонгүй.</p>}
      </div>

      <h2 className="mt-5 mb-2 text-[1.15rem] font-bold">🎧 Миний playlist</h2>
      {music.discovery && <ForYou mood={cm} />}
      {(music.youtube || music.spotify) && (
        <div className="mt-3 flex flex-col gap-3">
          <MusicLibrary provider="youtube" mood={cm} />
          <MusicLibrary provider="spotify" mood={cm} />
        </div>
      )}
      {!music.discovery && !music.youtube && !music.spotify && (
        <section className="card-x">
          <p className="mb-2 text-sm">«{cm.label}» мэдрэмжид тохирох дуунуудыг дараалуулан тоглуулна. YouTube эсвэл Spotify тохируулбал таны өөрийн дуунаас сонгож өгнө.</p>
          <Button size="xl" className="bg-spotify hover:bg-spotify/85" onClick={() => void play.mood(cm.id)}>▶ «{cm.label}» playlist тоглуулах</Button>
          <p className="mt-2 text-xs text-muted-foreground">Одоогоор хөгжмийн эх үүсвэр тохируулаагүй тул mood-ийн аялгууг браузер дээр үүсгэж тоглуулна (README → YouTube).</p>
        </section>
      )}
    </>
  );
}
