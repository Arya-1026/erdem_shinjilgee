'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { MusicKind } from '@/lib/music-suggest';
import { cn } from '@/lib/utils';
import type { Mood, SongRec } from '@/lib/types';
import { Eq } from './player';
import { useApp, type MusicProvider } from './providers/app-provider';
import { spTrack, usePlayer, ytTrack, type Track } from './providers/player-provider';
import { Segmented } from './segmented';
import { Button } from './ui/button';
import { usePlay, useSongRecs, useSpotifyTracks, useYouTubeTracks } from './use-play';

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? 'дөнгөж сая' : m < 60 ? `${m} мин өмнө` : m < 1440 ? `${Math.round(m / 60)} цагийн өмнө` : `${Math.round(m / 1440)} өдрийн өмнө`;
};

/* Нэг дууны мөр. YouTube-ийн дүрмээр тоглуулах thumbnail нь ≥120×70px. */
function SongRow({ t, onPlay, extra }: { t: Track; onPlay: () => void; extra?: React.ReactNode }) {
  const { nowId, playing } = usePlayer();
  const now = nowId === t.id;
  const wide = t.source === 'youtube';
  return (
    <div className="flex items-center gap-3 border-b py-2 last:border-0">
      <button onClick={onPlay} aria-label={`${t.title} тоглуулах`}
        className={cn('relative grid flex-none place-items-center overflow-hidden rounded-lg bg-[linear-gradient(135deg,#1DB954,#0F7A37)] text-white', wide ? 'h-[70px] w-[124px]' : 'size-11')}>
        {/* eslint-disable-next-line @next/next/no-img-element -- YouTube/Spotify CDN-ийн зураг */}
        {t.image ? <img src={t.image} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" /> : '♪'}
        {wide && <span className="absolute right-1 bottom-1 grid size-7 place-items-center rounded-full bg-black/70 text-xs">{now && playing ? <Eq /> : '▶'}</span>}
      </button>
      <div className="min-w-0 flex-1">
        <b className={cn('block truncate', now && 'text-spotify')}>{t.title}</b>
        <span className="block truncate text-sm text-muted-foreground">{t.artist}</span>
        {extra}
      </div>
      {!wide && (
        <button className="grid size-10 flex-none place-items-center rounded-full bg-spotify text-sm text-white" aria-label={`${t.title} тоглуулах`} onClick={onPlay}>
          {now && playing ? <Eq /> : '▶'}
        </button>
      )}
    </div>
  );
}

/* ---------- Тухайн хүнд зориулсан дуунууд (AI + YouTube) ---------- */
export function ForYou({ mood }: { mood: Mood }) {
  const { music, profile, feedback, setFeedback } = useApp();
  const [kind, setKind] = useState<MusicKind>('song');
  const { recs, loading, reason, refresh } = useSongRecs(mood.id, kind);
  const play = usePlay();
  if (!music.discovery) return null;

  const visible = (recs ?? []).filter(r => feedback['yt:' + r.video_id] !== -1);
  const tracks = visible.map(r => ytTrack(r, mood.id));
  const basis = profile.youtube_connected || profile.spotify_connected
    ? 'Таны сонсдог дуу, хобби, үнэлгээнд тулгуурласан'
    : 'Таны хобби, үнэлгээнд тулгуурласан. YouTube-ээ холбовол илүү оновчтой болно';
  const vote = (r: SongRec, v: 1 | -1) => {
    const id = 'yt:' + r.video_id;
    setFeedback(id, feedback[id] === v ? 0 : v);
    toast(v === 1 ? 'Баярлалаа! Ийм төрлийн дууг илүү санал болгоно 👍' : 'Ойлголоо, дараагийн удаа ийм дуу санал болгохгүй');
  };

  return (
    <section className="card-x">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><b>«{mood.label}» үед танд</b><div className="text-xs text-muted-foreground">{basis}</div></div>
        <button className="text-sm font-semibold text-primary disabled:opacity-50" disabled={loading} onClick={() => void refresh()}>↻ {kind === 'song' ? 'Шинэ дуунууд' : 'Шинэ аянууд'}</button>
      </div>
      <Segmented full label="Төрөл" className="mt-3" value={kind} onChange={setKind}
        options={[['song', '🎵 Дуу'], ['ambient', '🎼 Тайвшруулах ая']]} />
      {kind === 'ambient' && <p className="mt-2 text-xs text-muted-foreground">Үггүй хөгжим, байгалийн дуу, морин хуурын ая: амьсгалаа тайвшруулах, төвлөрөхөд тусална.</p>}
      {recs === null || (loading && !visible.length) ? (
        <p className="py-6 text-center text-sm text-muted-foreground">🎧 AI танд тохирохыг YouTube-ээс сонгож байна…</p>
      ) : !visible.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {reason === 'not-configured' ? 'YouTube хайлт тохируулагдаагүй байна.' : 'Одоогоор дуу олдсонгүй. «Шинэ дуунууд» дарж дахин оролдоорой.'}
        </p>
      ) : (
        <>
          <Button size="xl" className="my-2 w-full" onClick={() => play.list(tracks, 0)}>▶ Бүгдийг тоглуулах</Button>
          {visible.map((r, i) => (
            <SongRow key={r.video_id} t={tracks[i]} onPlay={() => play.list(tracks, i)} extra={<>
              {r.reason && <span className="block text-xs text-muted-foreground italic">💡 {r.reason}</span>}
              <span className="mt-1 flex gap-1">
                <button className={cn('rounded-md border px-2 text-xs', feedback['yt:' + r.video_id] === 1 && 'border-primary bg-secondary')} aria-label="Таалагдсан" onClick={() => vote(r, 1)}>👍</button>
                <button className="rounded-md border px-2 text-xs" aria-label="Таалагдаагүй" onClick={() => vote(r, -1)}>👎</button>
              </span>
            </>} />
          ))}
        </>
      )}
    </section>
  );
}

const META: Record<MusicProvider, { name: string; icon: string; color: string; pitch: string; note: string }> = {
  youtube: {
    name: 'YouTube', icon: '▶', color: 'bg-[#FF0033] hover:bg-[#FF0033]/85',
    pitch: 'YouTube-ээ холбоход таны playlist, like дарсан дуунуудыг сэтгэл хөдлөлөөр ангилж, тухайн үед тохирохыг нь санал болгоно. Бүтэн дуу үнэгүй тоглоно.',
    note: 'Бид зөвхөн уншина. YouTube дээр юу ч өөрчлөхгүй.',
  },
  spotify: {
    name: 'Spotify', icon: '🎧', color: 'bg-spotify hover:bg-spotify/85',
    pitch: 'Spotify-аа холбоход таны playlist, liked songs-ийг сэтгэл хөдлөлөөр ангилж, тухайн үед тохирохыг нь санал болгоно.',
    note: 'Premium бол апп дотроо бүтэн, бусад үед Spotify embed-ээр тоглоно.',
  },
};

/* ---------- Хэрэглэгчийн өөрийн сан (YouTube эсвэл Spotify) ---------- */
export function MusicLibrary({ provider, mood }: { provider: MusicProvider; mood: Mood }) {
  const app = useApp();
  const meta = META[provider];
  const connected = provider === 'youtube' ? app.profile.youtube_connected : app.profile.spotify_connected;
  const status = provider === 'youtube'
    ? app.youtube && { name: app.youtube.channel_title, synced_at: app.youtube.synced_at, count: app.youtube.track_count }
    : app.spotify && { name: app.spotify.display_name, synced_at: app.spotify.synced_at, count: app.spotify.track_count };
  const ytRows = useYouTubeTracks(mood.id), spRows = useSpotifyTracks(mood.id);
  const play = usePlay();
  if (!app.music[provider]) return null;

  const syncing = app.musicSyncing === provider;
  if (!connected) return (
    <section className="card-x">
      <p className="mb-2 text-sm">{meta.pitch}</p>
      <Button size="xl" className={meta.color} onClick={() => app.musicConnect(provider)}>{meta.icon} {meta.name} холбох</Button>
      <p className="mt-2 text-xs text-muted-foreground">{meta.note}</p>
    </section>
  );

  const rows = provider === 'youtube' ? ytRows : spRows;
  const tracks: Track[] | null = rows === null ? null
    : provider === 'youtube' ? (ytRows ?? []).map(r => ytTrack(r, mood.id)) : (spRows ?? []).map(r => spTrack(r, mood.id));

  return (
    <section className="card-x">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          <b>{meta.name}</b>{status?.name && ` · ${status.name}`} · {status?.count ?? 0} дуу{status?.synced_at && ` · ${ago(status.synced_at)} шинэчилсэн`}
        </span>
        <div className="flex gap-3 text-sm">
          <button className="font-semibold text-primary disabled:opacity-50" disabled={syncing} onClick={() => void app.musicSync(provider)}>{syncing ? 'Татаж байна…' : '↻ Шинэчлэх'}</button>
          <button className="text-muted-foreground" onClick={() => void app.musicDisconnect(provider)}>Салгах</button>
        </div>
      </div>
      {!status?.synced_at ? (
        <div className="py-4 text-center">
          <p className="mb-2 text-sm text-muted-foreground">Таны дуунуудыг хараахан татаагүй байна.</p>
          <Button size="xl" disabled={syncing} onClick={() => void app.musicSync(provider)}>{syncing ? 'Татаж байна…' : 'Дуунуудаа татах'}</Button>
        </div>
      ) : tracks === null ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Ачаалж байна…</p>
      ) : !tracks.length ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Таны сангаас «{mood.label}» мэдрэмжид тохирох дуу олдсонгүй.</p>
      ) : (
        <>
          <p className="mt-1 text-sm">«{mood.label}» үед таны сангаас {tracks.length} дуу:</p>
          {tracks.map((t, i) => <SongRow key={t.id} t={t} onPlay={() => play.list(tracks, i)} />)}
          <p className="mt-2 text-xs text-muted-foreground">Дуунуудыг AI сэтгэл хөдлөлөөр ангилсан. {meta.note}</p>
        </>
      )}
    </section>
  );
}
