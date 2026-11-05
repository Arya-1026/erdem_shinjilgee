'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { pickGenres } from '@/lib/mn-songs';
import type { MusicKind } from '@/lib/music-suggest';
import { spotifyTrackUrl } from '@/lib/spotify-parse';
import { cn } from '@/lib/utils';
import type { Mood, SongRec, SpotifyTrackRow } from '@/lib/types';
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
  name: 'Spotify', icon: '🎧', color: 'bg-spotify hover:bg-spotify/85',
  pitch: 'Spotify-аа холбоход таны playlist, liked songs-ийг сэтгэл хөдлөлөөр ангилж, тухайн үед тохирохыг нь санал болгоно. Premium бол апп дотроо бүтэн дуу тоглоно.',
  note: 'Апп дотор бүтэн дуу зөвхөн Premium бүртгэлээ холбосон үед тоглоно. Бусад үед 30 орчим секундын хэсэг тоглох тул бүтэн сонсохын тулд «Spotify-д нээх»-ийг дарна уу.',
};

/* ---------- Профайл: Spotify бүртгэл холбох, салгах ---------- */
export function SpotifyAccount() {
  const tr = useT();
  const app = useApp();
  if (!app.music.spotify) return null;
  const syncing = app.musicSyncing === 'spotify', s = app.spotify;
  return (
    <section className="card-x" aria-label={tr('Spotify бүртгэл')}>
      <div className="flex items-center gap-3">
        <span className="grid size-11 flex-none place-items-center rounded-full bg-spotify text-xl text-white" aria-hidden="true">🎧</span>
        <div className="min-w-0">
          <h3 className="font-semibold">Spotify</h3>
          <p className="text-sm text-muted-foreground">{app.profile.spotify_connected ? tr('Холбогдсон ✓ {0}', s?.display_name ?? '') : tr('Холбоогүй байна')}</p>
        </div>
      </div>
      {app.profile.spotify_connected ? (
        <>
          <p className="mt-3 text-sm">{tr('{0} дуу', s?.track_count ?? 0)}{s?.synced_at && tr(' · {0} шинэчилсэн', ago(s.synced_at, tr))}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="xl" variant="secondary" className="h-11" disabled={syncing} onClick={() => void app.musicSync('spotify')}>{syncing ? tr('Татаж байна…') : tr('↻ Дуунуудаа шинэчлэх')}</Button>
            <Button size="xl" variant="outline" className="h-11" onClick={() => void app.musicDisconnect('spotify')}>{tr('Салгах')}</Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm">{tr(META.pitch)}</p>
          <Button size="xl" className="mt-3 w-full bg-spotify text-white hover:bg-spotify/85" onClick={() => app.musicConnect('spotify')}>{tr('🎧 Spotify бүртгэл холбох')}</Button>
          <p className="mt-2 text-xs text-muted-foreground">{tr('Зөвхөн уншина, Spotify дээр юу ч өөрчлөхгүй. {0}', tr(META.note))}</p>
        </>
      )}
    </section>
  );
}

/* ---------- Spotify-д нэвтрэлгүй өөрийн сан: дууны холбоосуудаа буулгаж оруулна ---------- */
function PlaylistImport({ mood, rows }: { mood: Mood; rows: SpotifyTrackRow[] | null }) {
  const tr = useT();
  const { supabase, libraryVersion, bumpLibrary, musicConnect } = useApp();
  const play = usePlay();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.from('spotify_tracks').select('track_id', { count: 'exact', head: true })
      .then(({ count: n }) => { if (alive) setCount(n ?? 0); });
    return () => { alive = false; };
  }, [supabase, libraryVersion]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const t = toast.loading(tr('Дуунуудыг уншиж, сэтгэл хөдлөлөөр ангилж байна…'));
    try {
      const res = await fetch('/api/music/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      const j: { added?: number; failed?: number; skipped?: number; error?: string } = await res.json().catch(() => ({ error: 'failed' }));
      if (!res.ok) {
        const message = j.error === 'not-track-links' ? tr('Энэ нь playlist эсвэл цомгийн холбоос байна. Playlist дотроос дуунуудаа сонгож хуулна уу.')
          : j.error === 'no-tracks' ? tr('Дууны холбоос олдсонгүй. Spotify-аас дуунуудаа хуулаад дахин буулгана уу.')
          : tr('Дуунуудыг оруулж чадсангүй. Дахин оролдоно уу.');
        return void toast.error(message, { id: t });
      }
      if (j.added) toast.success(tr('{0} дуу нэмэгдэж, сэтгэл хөдлөлөөр ангилагдлаа 🎧', j.added), { id: t });
      else toast(j.skipped ? tr('Таны сан дүүрсэн байна. Эхлээд цэвэрлэнэ үү.') : tr('Эдгээр дуу таны санд аль хэдийн байна'), { id: t });
      if (j.failed || j.skipped) toast(tr('Уншиж чадаагүй {0}, оруулаагүй {1} дуу байна. Дахин буулгаж нэмж болно.', j.failed ?? 0, j.skipped ?? 0));
      setText(''); setOpen(false);
      bumpLibrary();
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    if (!confirm(tr('Оруулсан бүх дуугаа сангаас устгах уу?'))) return;
    const res = await fetch('/api/music/import', { method: 'DELETE' });
    if (!res.ok) return void toast.error(tr('Цэвэрлэж чадсангүй'));
    toast(tr('Сан цэвэрлэгдлээ'));
    bumpLibrary();
  }

  const tracks = (rows ?? []).map(r => spTrack(r, mood.id));
  const hasLibrary = Boolean(count);
  return (
    <section className="card-x" aria-label={tr('Миний сан')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b>{tr('🎧 Миний сан')}{hasLibrary && <span className="ml-1.5 text-sm font-normal text-muted-foreground">{tr('{0} дуу', count)}</span>}</b>
        {hasLibrary && (
          <div className="flex gap-3 text-sm">
            <button className="font-semibold text-primary" aria-expanded={open} onClick={() => setOpen(!open)}>{tr('＋ Дуу нэмэх')}</button>
            <button className="text-muted-foreground" onClick={() => void clear()}>{tr('Цэвэрлэх')}</button>
          </div>
        )}
      </div>
      {hasLibrary && (rows === null ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{tr('Ачаалж байна…')}</p>
      ) : !tracks.length ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{tr('Таны сангаас «{0}» мэдрэмжид тохирох дуу олдсонгүй.', tr(mood.label))}</p>
      ) : (
        <>
          <p className="mt-1 text-sm">{tr('«{0}» үед таны сангаас {1} дуу:', tr(mood.label), tracks.length)}</p>
          {tracks.map((t, i) => <SongRow key={t.id} t={t} onPlay={() => play.list(tracks, i)} />)}
        </>
      ))}
      {(count === 0 || open) && (
        <form className="mt-2" onSubmit={e => void submit(e)}>
          <p className="text-sm">{tr('Playlist-ээ оруулбал дуунуудыг тань сэтгэл хөдлөлөөр ангилж, тухайн үед тохирохыг нь гаргана. Энд Spotify бүртгэлээр нэвтрэх шаардлагагүй.')}</p>
          <ol className="my-2 list-decimal pl-5 text-sm text-muted-foreground">
            <li>{tr('Spotify-ийн компьютерийн апп дээр playlist-ээ нээгээд нэг дууг дарна.')}</li>
            <li>{tr('Ctrl+A, дараа нь Ctrl+C дарна (Mac: ⌘A, ⌘C).')}</li>
            <li>{tr('Доорх хэсэгт буулгаж (Ctrl+V), «Сандаа нэмэх»-ийг дарна.')}</li>
          </ol>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={4} maxLength={100_000} aria-label={tr('Дууны холбоосууд')} placeholder="https://open.spotify.com/track/…"
            className="w-full rounded-xl border-[1.5px] bg-background p-3 text-sm focus:border-primary focus:outline-none" />
          <Button type="submit" size="xl" className="mt-2 w-full" disabled={busy || !text.trim()}>{busy ? tr('Оруулж байна…') : tr('Сандаа нэмэх')}</Button>
        </form>
      )}
      <p className="mt-2 text-xs text-muted-foreground">{tr(META.note)}</p>
      <button className="mt-2 text-xs font-semibold text-primary" onClick={() => musicConnect('spotify')}>{tr('Апп-ын жагсаалтад бүртгэлтэй бол Spotify холбох')}</button>
    </section>
  );
}

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
  if (!connected) return <PlaylistImport mood={mood} rows={spRows} />;

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
