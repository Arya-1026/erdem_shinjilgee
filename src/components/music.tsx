'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { pickGenres } from '@/lib/mn-songs';
import type { MusicKind } from '@/lib/music-suggest';
import { cn } from '@/lib/utils';
import type { Mood, SongRec } from '@/lib/types';
import { Eq } from './player';
import { useApp } from './providers/app-provider';
import { songTrack, spTrack, usePlayer, type Track } from './providers/player-provider';
import { Segmented } from './segmented';
import { Button } from './ui/button';
import { usePlay, useSongRecs, useSpotifyTracks } from './use-play';

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? 'дөнгөж сая' : m < 60 ? `${m} мин өмнө` : m < 1440 ? `${Math.round(m / 60)} цагийн өмнө` : `${Math.round(m / 1440)} өдрийн өмнө`;
};

/* Нэг дууны мөр */
function SongRow({ t, onPlay, extra }: { t: Track; onPlay: () => void; extra?: React.ReactNode }) {
  const { nowId, playing } = usePlayer();
  const now = nowId === t.id;
  return (
    <div className="flex items-center gap-3 border-b py-2 last:border-0">
      <button onClick={onPlay} aria-label={`${t.title} тоглуулах`}
        className={cn('relative grid size-11 flex-none place-items-center overflow-hidden rounded-lg bg-[linear-gradient(135deg,#1DB954,#0F7A37)] text-white')}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Spotify CDN-ийн зураг */}
        {t.image ? <img src={t.image} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" /> : '♪'}
      </button>
      <div className="min-w-0 flex-1">
        <b className={cn('block truncate', now && 'text-spotify')}>{t.title}</b>
        <span className="block truncate text-sm text-muted-foreground">{t.artist}</span>
        {extra}
      </div>
      <button className="grid size-10 flex-none place-items-center rounded-full bg-spotify text-sm text-white" aria-label={`${t.title} тоглуулах`} onClick={onPlay}>
        {now && playing ? <Eq /> : '▶'}
      </button>
    </div>
  );
}

/* ---------- Дуу хайх (Spotify). Квот хэмнэхийн тулд Enter/товч дарахад л хайна. ---------- */
function SongSearch({ mood, isLiked, onLike }: { mood: Mood; isLiked: (r: SongRec) => boolean; onLike: (r: SongRec) => void }) {
  const play = usePlay();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ q: string; rows: SongRec[] } | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term.length < 2) return void toast('Хамгийн багадаа 2 үсэг бичнэ үү');
    setBusy(true);
    try {
      const r = await fetch(`/api/music/search?q=${encodeURIComponent(term)}`);
      const j: { results?: SongRec[]; error?: string } = await r.json().catch(() => ({}));
      if (r.status === 429) return void toast.error('Spotify хайлтын хязгаарт хүрлээ. Түр хүлээгээд дахин оролдоорой.');
      if (!r.ok || !j.results) return void toast.error('Хайж чадсангүй. Дахин оролдоно уу.');
      setRes({ q: term, rows: j.results });
    } finally {
      setBusy(false);
    }
  }

  const tracks = (res?.rows ?? []).map(r => songTrack(r, mood.id));
  return (
    <div className="mt-3">
      <form role="search" className="flex gap-2" onSubmit={e => void search(e)}>
        <input type="search" aria-label="Дуу, дуучин хайх" placeholder="🔍 Дуу, дуучин хайх…" value={q} maxLength={80} onChange={e => setQ(e.target.value)}
          className="min-h-11 min-w-0 flex-1 rounded-xl border-[1.5px] bg-background px-3 focus:border-primary focus:outline-none" />
        <Button type="submit" size="xl" variant="secondary" className="h-11 flex-none" disabled={busy || q.trim().length < 2}>{busy ? '…' : 'Хайх'}</Button>
      </form>
      {res && (
        <div className="mt-2 rounded-2xl bg-background/50 p-3" aria-live="polite">
          <div className="flex items-center justify-between gap-2">
            <b className="min-w-0 truncate text-sm">«{res.q}» хайлтын үр дүн</b>
            <button className="flex-none text-sm font-semibold text-primary" onClick={() => { setRes(null); setQ(''); }}>✕ Хаах</button>
          </div>
          {res.rows.length ? res.rows.map((r, i) => (
            <SongRow key={r.video_id} t={tracks[i]} onPlay={() => play.list(tracks, i)} extra={
              <span className="mt-1 flex gap-1">
                <button className={cn('rounded-md border px-2 text-xs', isLiked(r) && 'border-primary bg-secondary')} aria-label="Таалагдсан" aria-pressed={isLiked(r)} onClick={() => onLike(r)}>👍</button>
              </span>
            } />
          )) : <p className="py-3 text-center text-sm text-muted-foreground">Дуу олдсонгүй. Өөр үгээр хайгаарай.</p>}
        </div>
      )}
    </div>
  );
}

/* ---------- Тухайн хүнд зориулсан дуунууд (AI + Spotify) ---------- */
export function ForYou({ mood }: { mood: Mood }) {
  const { music, profile, feedback, setFeedback, likedSongs, toggleLike } = useApp();
  const [kind, setKind] = useState<MusicKind>('song');
  const { recs, loading, reason, refresh } = useSongRecs(mood.id, kind);
  const play = usePlay();
  if (!music.discovery) return null;

  const visible = (recs ?? []).filter(r => feedback['sp:' + r.video_id] !== -1);
  const tracks = visible.map(r => songTrack(r, mood.id));
  const taste = [...profile.fav_artists.slice(0, 3), ...pickGenres(profile.hobbies).slice(0, 3)];
  const basis = profile.spotify_connected
    ? 'Таны сонсдог дуу, хобби, үнэлгээнд тулгуурласан'
    : 'Таны хобби, үнэлгээнд тулгуурласан. Spotify-аа холбовол илүү оновчтой болно';
  const isLiked = (r: SongRec) => likedSongs.some(x => x.video_id === r.video_id);
  const like = (r: SongRec) => {
    toast(isLiked(r) ? 'Таалагдсан дуунаас хасагдлаа' : 'Таалагдсан дуунд хадгалагдлаа 💚');
    toggleLike({ video_id: r.video_id, title: r.title, artist: r.artist, thumbnail: r.thumbnail, duration_s: r.duration_s });
  };
  const dislike = (r: SongRec) => {
    setFeedback('sp:' + r.video_id, -1);
    toast('Ойлголоо, дараагийн удаа ийм дуу санал болгохгүй');
  };

  return (
    <section className="card-x">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><b>«{mood.label}» үед танд</b><div className="text-xs text-muted-foreground">{basis}</div></div>
        <button className="text-sm font-semibold text-primary disabled:opacity-50" disabled={loading} onClick={() => void refresh()}>↻ {kind === 'song' ? 'Шинэ дуунууд' : 'Шинэ аянууд'}</button>
      </div>
      <SongSearch mood={mood} isLiked={isLiked} onLike={like} />
      <Segmented full label="Төрөл" className="mt-3" value={kind} onChange={setKind}
        options={[['song', '🎵 Дуу'], ['ambient', '🎼 Тайвшруулах ая']]} />
      {kind === 'song' && (
        <p className="mt-2 text-xs text-muted-foreground">
          {taste.length ? `${taste.join(', ')}. ` : 'Насаа, дуртай дуучин, төрлөө сонговол монгол, олон улсын дууг түүгээр нь санал болгоно. '}
          <Link href="/onboarding?edit=1" className="font-semibold text-primary">{taste.length ? 'Өөрчлөх' : 'Сонгох'}</Link>
        </p>
      )}
      {kind === 'ambient' && <p className="mt-2 text-xs text-muted-foreground">Үггүй хөгжим, байгалийн дуу, морин хуурын ая: амьсгалаа тайвшруулах, төвлөрөхөд тусална.</p>}
      {recs === null || (loading && !visible.length) ? (
        <p className="py-6 text-center text-sm text-muted-foreground">🎧 AI танд тохирохыг Spotify-аас сонгож байна…</p>
      ) : !visible.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {reason === 'not-configured' ? 'Spotify тохируулагдаагүй байна.' : 'Одоогоор дуу олдсонгүй. «Шинэ дуунууд» дарж дахин оролдоорой.'}
        </p>
      ) : (
        <>
          <Button size="xl" className="my-2 w-full" onClick={() => play.list(tracks, 0)}>▶ Бүгдийг тоглуулах</Button>
          {visible.map((r, i) => (
            <SongRow key={r.video_id} t={tracks[i]} onPlay={() => play.list(tracks, i)} extra={<>
              {r.reason && <span className="block text-xs text-muted-foreground italic">💡 {r.reason}</span>}
              <span className="mt-1 flex gap-1">
                <button className={cn('rounded-md border px-2 text-xs', isLiked(r) && 'border-primary bg-secondary')} aria-label="Таалагдсан" aria-pressed={isLiked(r)} onClick={() => like(r)}>👍</button>
                <button className="rounded-md border px-2 text-xs" aria-label="Таалагдаагүй" onClick={() => dislike(r)}>👎</button>
              </span>
            </>} />
          ))}
        </>
      )}
    </section>
  );
}

/* ---------- 👍 дарж хадгалсан дуунууд ---------- */
export function LikedSongs({ mood }: { mood: Mood }) {
  const { likedSongs, toggleLike } = useApp();
  const play = usePlay();
  if (!likedSongs.length) return null;
  const tracks = likedSongs.map(s => songTrack(s, mood.id));
  return (
    <section className="card-x">
      <b>💚 Таалагдсан дуунууд</b>
      <div className="text-xs text-muted-foreground">{likedSongs.length} дуу хадгалагдсан</div>
      {tracks.map((t, i) => (
        <SongRow key={t.id} t={t} onPlay={() => play.list(tracks, i)} extra={
          <button className="mt-1 rounded-md border px-2 text-xs" aria-label={`${t.title} хасах`} onClick={() => toggleLike(likedSongs[i])}>Хасах</button>
        } />
      ))}
    </section>
  );
}

const META = {
  name: 'Spotify', icon: '🎧', color: 'bg-spotify hover:bg-spotify/85',
  pitch: 'Spotify-аа холбоход таны playlist, liked songs-ийг сэтгэл хөдлөлөөр ангилж, тухайн үед тохирохыг нь санал болгоно. Premium бол апп дотроо бүтэн дуу тоглоно.',
  note: 'Premium бол апп дотроо бүтэн, бусад үед Spotify embed-ээр тоглоно.',
};

/* ---------- Хэрэглэгчийн өөрийн Spotify сан ---------- */
export function MusicLibrary({ mood }: { mood: Mood }) {
  const app = useApp();
  const meta = META, provider = 'spotify' as const;
  const connected = app.profile.spotify_connected;
  const status = app.spotify && { name: app.spotify.display_name, synced_at: app.spotify.synced_at, count: app.spotify.track_count };
  const spRows = useSpotifyTracks(mood.id);
  const play = usePlay();
  if (!app.music.spotify) return null;

  const syncing = app.musicSyncing === provider;
  if (!connected) return (
    <section className="card-x">
      <p className="mb-2 text-sm">{meta.pitch}</p>
      <Button size="xl" className={meta.color} onClick={() => app.musicConnect(provider)}>{meta.icon} {meta.name} холбох</Button>
      <p className="mt-2 text-xs text-muted-foreground">{meta.note}</p>
    </section>
  );

  const tracks: Track[] | null = spRows === null ? null : spRows.map(r => spTrack(r, mood.id));

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
