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
import type { Translate } from '@/lib/i18n';
import type { MoodId, RecType } from '@/lib/types';
import { useT } from '@/components/providers/locale-provider';

type Tab = 'all' | RecType | 'song';
const TABS: [Tab, string][] = [['all', 'Бүгд'], ['exercise', '🧘 Дасгал'], ['song', '🎵 Дуу'], ['movie', '🎬 Кино']];

// /api/spotify/login, callback-аас буцаж ирэх үеийн мэдэгдэл
function connectMessages(tr: Translate): Record<string, string> {
  const name = 'Spotify', env = 'SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, TOKEN_ENCRYPTION_KEY';
  const users = tr('Таны Spotify бүртгэл энэ апп-ын хэрэглэгчийн жагсаалтад алга (Spotify Dashboard → User Management).');
  return {
    'not-configured': tr('{0} тохируулагдаагүй байна ({1}).', name, env),
    'wrong-host': tr('{0} холбохын тулд компьютерийнхаа хөтчөөр http://127.0.0.1:3000 хаягийг нээж нэвтэрнэ үү. Утаснаас (192.168…) {1} холбох боломжгүй.', name, name),
    state: tr('Аюулгүй байдлын шалгалт амжилтгүй. Дахин оролдоно уу.'),
    denied: tr('{0} холболтыг цуцаллаа. {1}', name, users),
    'not-allowlisted': users,
    error: tr('{0} холбоход алдаа гарлаа.', name),
  };
}

export default function RecsPage() {
  const tr = useT();
  const { profile, feedback, activeMood: saved, setFeedback, musicSync, music } = useApp();
  // Өөр mood-ын зөвлөмжийг зөвхөн энэ хуудсанд урьдчилан харна; хуудаснаас гарахад сүүлийн бүртгэл рүүгээ буцна
  const [picked, setPicked] = useState<MoodId | null>(null);
  const cm = picked ? moodById(picked) : saved;
  const preview = cm.id !== saved.id;
  const [tab, setTab] = useState<Tab>('all');
  const list = scoredRecs(cm, profile.hobbies, feedback).filter(x => tab === 'all' || x.type === tab);
  const params = useSearchParams(), router = useRouter(), path = usePathname();

  useEffect(() => {
    const p = 'spotify' as const, s = params.get(p); if (!s) return;
    router.replace(path, { scroll: false });
    // Холбогдсон даруйд дуунуудыг татаж ангилна
    if (s === 'connected') { toast.success(tr('Spotify холбогдлоо 🎧')); void musicSync(p); }
    else { const msg = connectMessages(tr); toast.error(msg[s] ?? msg.error, { duration: 8000 }); }
  }, [params, router, path, musicSync, tr]);

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
            <MusicLibrary mood={cm} />
          </div>
        </>
      )}
    </>
  );
}
