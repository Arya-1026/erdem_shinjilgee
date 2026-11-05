'use client';

import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { pickGenres } from '@/lib/mn-songs';
import type { MusicKind } from '@/lib/music-suggest';
import { spotifyTrackUrl } from '@/lib/spotify-parse';
import { cn } from '@/lib/utils';
import type { Mood, SongRec } from '@/lib/types';
import { Eq } from './player';
import { useApp } from './providers/app-provider';
import { songTrack, spTrack, usePlayer, type Track } from './providers/player-provider';
import { Segmented } from './segmented';
import { Button } from './ui/button';
import { usePlay, useSongRecs, useSpotifyTracks } from './use-play';
import { useLocale, useT } from '@/components/providers/locale-provider';
import { translateReason, type Translate } from '@/lib/i18n';

const ago = (iso: string, tr: Translate) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 1 ? tr('дөнгөж сая') : m < 60 ? tr('{0} мин өмнө', m) : m < 1440 ? tr('{0} цагийн өмнө', Math.round(m / 60)) : tr('{0} өдрийн өмнө', Math.round(m / 1440));
};

/* Нэг дууны мөр */
function SongRow({ t, onPlay, extra }: { t: Track; onPlay: () => void; extra?: React.ReactNode }) {
  const tr = useT();
  const { nowId, playing } = usePlayer();
  const now = nowId === t.id, url = spotifyTrackUrl(t.uri);
  return (
    <div className="flex items-center gap-3 border-b py-2 last:border-0">
      <button onClick={onPlay} aria-label={tr('{0} тоглуулах', t.title)}
        className={cn('relative grid size-11 flex-none place-items-center overflow-hidden rounded-lg bg-[linear-gradient(135deg,#1DB954,#0F7A37)] text-white')}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Spotify CDN-ийн зураг */}
        {t.image ? <img src={t.image} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" /> : '♪'}
      </button>
      <div className="min-w-0 flex-1">
        <b className={cn('block truncate', now && 'text-spotify')}>{t.title}</b>
        <span className="block truncate text-sm text-muted-foreground">{t.artist}</span>
        {extra}
        {url && <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-semibold text-primary" aria-label={tr('{0} дууг Spotify-д нээх', t.title)}>{tr('Spotify-д нээх ↗')}</a>}
      </div>
      <button className="grid size-10 flex-none place-items-center rounded-full bg-spotify text-sm text-white" aria-label={tr('{0} тоглуулах', t.title)} onClick={onPlay}>
        {now && playing ? <Eq /> : '▶'}
      </button>
    </div>
  );
}

/* ---------- Дуу хайх (Spotify). Квот хэмнэхийн тулд Enter/товч дарахад л хайна. ---------- */
function SongSearch({ mood, isLiked, onLike }: { mood: Mood; isLiked: (r: SongRec) => boolean; onLike: (r: SongRec) => void }) {
  const tr = useT();
  const play = usePlay();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ q: string; rows: SongRec[] } | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    if (term.length < 2) return void toast(tr('Хамгийн багадаа 2 үсэг бичнэ үү'));
    setBusy(true);
    try {
      const r = await fetch(`/api/music/search?q=${encodeURIComponent(term)}`);
      const j: { results?: SongRec[]; error?: string } = await r.json().catch(() => ({}));
      if (r.status === 429) return void toast.error(tr('Spotify хайлтын хязгаарт хүрлээ. Түр хүлээгээд дахин оролдоорой.'));
      if (!r.ok || !j.results) return void toast.error(tr('Хайж чадсангүй. Дахин оролдоно уу.'));
      setRes({ q: term, rows: j.results });
    } finally {
      setBusy(false);
    }
  }

  const tracks = (res?.rows ?? []).map(r => songTrack(r, mood.id));
  return (
    <div className="mt-3">
      <form role="search" className="flex gap-2" onSubmit={e => void search(e)}>
        <input type="search" aria-label={tr('Дуу, дуучин хайх')} placeholder={tr('🔍 Дуу, дуучин хайх…')} value={q} maxLength={80} onChange={e => setQ(e.target.value)}
          className="min-h-11 min-w-0 flex-1 rounded-xl border-[1.5px] bg-background px-3 focus:border-primary focus:outline-none" />
        <Button type="submit" size="xl" variant="secondary" className="h-11 flex-none" disabled={busy || q.trim().length < 2}>{busy ? '…' : tr('Хайх')}</Button>
      </form>
      {res && (
        <div className="mt-2 rounded-2xl bg-background/50 p-3" aria-live="polite">
          <div className="flex items-center justify-between gap-2">
            <b className="min-w-0 truncate text-sm">{tr('«{0}» хайлтын үр дүн', res.q)}</b>
            <button className="flex-none text-sm font-semibold text-primary" onClick={() => { setRes(null); setQ(''); }}>{tr('✕ Хаах')}</button>
          </div>
          {res.rows.length ? res.rows.map((r, i) => (
            <SongRow key={r.video_id} t={tracks[i]} onPlay={() => play.list(tracks, i)} extra={
              <span className="mt-1 flex gap-1">
                <button className={cn('rounded-md border px-2 text-xs', isLiked(r) && 'border-primary bg-secondary')} aria-label={tr('Таалагдсан')} aria-pressed={isLiked(r)} onClick={() => onLike(r)}>👍</button>
              </span>
            } />
          )) : <p className="py-3 text-center text-sm text-muted-foreground">{tr('Дуу олдсонгүй. Өөр үгээр хайгаарай.')}</p>}
        </div>
      )}
    </div>
  );
}

/* ---------- Тухайн хүнд зориулсан дуунууд (AI + Spotify) ---------- */
export function ForYou({ mood }: { mood: Mood }) {
  const { locale } = useLocale();
  const tr = useT();
  const { music, profile, feedback, setFeedback, likedSongs, toggleLike } = useApp();
  const [kind, setKind] = useState<MusicKind>('song');
  const { recs, loading, reason, refresh } = useSongRecs(mood.id, kind);
  const play = usePlay();
  if (!music.discovery) return null;

  const visible = (recs ?? []).filter(r => feedback['sp:' + r.video_id] !== -1);
  const tracks = visible.map(r => songTrack(r, mood.id));
  const taste = [...profile.fav_artists.slice(0, 3), ...pickGenres(profile.hobbies).slice(0, 3).map(g => tr(g))];
  const basis = profile.spotify_connected
    ? tr('Таны сонсдог дуу, хобби, үнэлгээнд тулгуурласан')
    : tr('Таны хобби, үнэлгээнд тулгуурласан');
  const isLiked = (r: SongRec) => likedSongs.some(x => x.video_id === r.video_id);
  const like = (r: SongRec) => {
    toast(isLiked(r) ? tr('Таалагдсан дуунаас хасагдлаа') : tr('Таалагдсан дуунд хадгалагдлаа 💚'));
    toggleLike({ video_id: r.video_id, title: r.title, artist: r.artist, thumbnail: r.thumbnail, duration_s: r.duration_s });
  };
  const dislike = (r: SongRec) => {
    setFeedback('sp:' + r.video_id, -1);
    toast(tr('Ойлголоо, дараагийн удаа ийм дуу санал болгохгүй'));
  };

  return (
    <section className="card-x">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><b>{tr('«{0}» үед танд', tr(mood.label))}</b><div className="text-xs text-muted-foreground">{basis}</div></div>
        <button className="text-sm font-semibold text-primary disabled:opacity-50" disabled={loading} onClick={() => void refresh()}>↻ {kind === 'song' ? tr('Шинэ дуунууд') : tr('Шинэ аянууд')}</button>
      </div>
      <SongSearch mood={mood} isLiked={isLiked} onLike={like} />
      <Segmented full label={tr('Төрөл')} className="mt-3" value={kind} onChange={setKind}
        options={[['song', tr('🎵 Дуу')], ['ambient', tr('🎼 Тайвшруулах ая')]]} />
      {kind === 'song' && (
        <p className="mt-2 text-xs text-muted-foreground">
          {taste.length ? `${taste.join(', ')}. ` : tr('Насаа, дуртай дуучин, төрлөө сонговол монгол, олон улсын дууг түүгээр нь санал болгоно. ')}
          <Link href="/onboarding?edit=1" className="font-semibold text-primary">{taste.length ? tr('Өөрчлөх') : tr('Сонгох')}</Link>
        </p>
      )}
      {kind === 'ambient' && <p className="mt-2 text-xs text-muted-foreground">{tr('Үггүй хөгжим, байгалийн дуу, морин хуурын ая: амьсгалаа тайвшруулах, төвлөрөхөд тусална.')}</p>}
      {recs === null || (loading && !visible.length) ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{tr('🎧 AI танд тохирохыг Spotify-аас сонгож байна…')}</p>
      ) : !visible.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {reason === 'not-configured' ? tr('Spotify тохируулагдаагүй байна.') : tr('Одоогоор дуу олдсонгүй. «Шинэ дуунууд» дарж дахин оролдоорой.')}
        </p>
      ) : (
        <>
          {reason === 'quota' && <p className="mt-2 text-xs text-muted-foreground">{tr('Spotify-ийн хайлтын хязгаарт хүрсэн тул одоо хадгалагдсан дуунаас санал болгож байна. Хязгаар нээгдэхэд шинэчлэгдэнэ.')}</p>}
          <Button size="xl" className="my-2 w-full" onClick={() => play.list(tracks, 0)}>{tr('▶ Бүгдийг тоглуулах')}</Button>
          {visible.map((r, i) => (
            <SongRow key={r.video_id} t={tracks[i]} onPlay={() => play.list(tracks, i)} extra={<>
              {translateReason(locale, r.reason) && <span className="block text-xs text-muted-foreground italic">💡 {translateReason(locale, r.reason)}</span>}
              <span className="mt-1 flex gap-1">
                <button className={cn('rounded-md border px-2 text-xs', isLiked(r) && 'border-primary bg-secondary')} aria-label={tr('Таалагдсан')} aria-pressed={isLiked(r)} onClick={() => like(r)}>👍</button>
                <button className="rounded-md border px-2 text-xs" aria-label={tr('Таалагдаагүй')} onClick={() => dislike(r)}>👎</button>
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
  const tr = useT();
  const { likedSongs, toggleLike } = useApp();
  const play = usePlay();
  if (!likedSongs.length) return null;
  const tracks = likedSongs.map(s => songTrack(s, mood.id));
  return (
    <section className="card-x">
      <b>{tr('💚 Таалагдсан дуунууд')}</b>
      <div className="text-xs text-muted-foreground">{tr('{0} дуу хадгалагдсан', likedSongs.length)}</div>
      {tracks.map((t, i) => (
        <SongRow key={t.id} t={t} onPlay={() => play.list(tracks, i)} extra={
          <button className="mt-1 rounded-md border px-2 text-xs" aria-label={tr('{0} хасах', t.title)} onClick={() => toggleLike(likedSongs[i])}>{tr('Хасах')}</button>
        } />
      ))}
    </section>
  );
}

const META = {
  name: 'Spotify',
  note: 'Premium бол апп дотроо Spotify-аар бүтэн тоглоно. Бусад үед YouTube-ээр тоглоно.',
};


/* ---------- Хэрэглэгчийн өөрийн Spotify сан ---------- */
export function MusicLibrary({ mood }: { mood: Mood }) {
  const tr = useT();
  const app = useApp();
  const meta = META, provider = 'spotify' as const;
  const connected = app.profile.spotify_connected;
  const status = app.spotify && { name: app.spotify.display_name, synced_at: app.spotify.synced_at, count: app.spotify.track_count };
  const spRows = useSpotifyTracks(mood.id);
  const play = usePlay();
  if (!app.music.spotify) return null;

  const syncing = app.musicSyncing === provider;
  if (!connected) return null;

  const tracks: Track[] | null = spRows === null ? null : spRows.map(r => spTrack(r, mood.id));

  return (
    <section className="card-x">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">
          <b>{meta.name}</b>{tr('{0} · {1} дуу', status?.name && ` · ${status.name}`, status?.count ?? 0)}{status?.synced_at && tr(' · {0} шинэчилсэн', ago(status.synced_at, tr))}
        </span>
        <div className="flex gap-3 text-sm">
          <button className="font-semibold text-primary disabled:opacity-50" disabled={syncing} onClick={() => void app.musicSync(provider)}>{syncing ? tr('Татаж байна…') : tr('↻ Шинэчлэх')}</button>
          <button className="text-muted-foreground" onClick={() => void app.musicDisconnect(provider)}>{tr('Салгах')}</button>
        </div>
      </div>
      {!status?.synced_at ? (
        <div className="py-4 text-center">
          <p className="mb-2 text-sm text-muted-foreground">{tr('Таны дуунуудыг хараахан татаагүй байна.')}</p>
          <Button size="xl" disabled={syncing} onClick={() => void app.musicSync(provider)}>{syncing ? tr('Татаж байна…') : tr('Дуунуудаа татах')}</Button>
        </div>
      ) : tracks === null ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{tr('Ачаалж байна…')}</p>
      ) : !tracks.length ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{tr('Таны сангаас «{0}» мэдрэмжид тохирох дуу олдсонгүй.', tr(mood.label))}</p>
      ) : (
        <>
          <p className="mt-1 text-sm">{tr('«{0}» үед таны сангаас {1} дуу:', tr(mood.label), tracks.length)}</p>
          {tracks.map((t, i) => <SongRow key={t.id} t={t} onPlay={() => play.list(tracks, i)} />)}
          <p className="mt-2 text-xs text-muted-foreground">{tr('Дуунуудыг AI сэтгэл хөдлөлөөр ангилсан. {0}', tr(meta.note))}</p>
        </>
      )}
    </section>
  );
}
