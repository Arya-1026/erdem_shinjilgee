'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { moodById } from '@/lib/data';
import { fmtSec } from '@/lib/date';
import { spotifyTrackUrl } from '@/lib/spotify-parse';
import { cn } from '@/lib/utils';
import { MoodFace } from './mood-face';
import { useApp } from './providers/app-provider';
import { usePlayer, useTicker, type Track } from './providers/player-provider';
import { useT } from '@/components/providers/locale-provider';

export const Eq = ({ className }: { className?: string }) => <span className={cn('eq', className)}><i /><i /><i /></span>;

// Spotify дуу бол цомгийн зураг, демо аялгуу бол mood-ийн emoji
function Cover({ t, className }: { t: Track; className?: string }) {
  return t.image
    // eslint-disable-next-line @next/next/no-img-element -- Spotify CDN-ийн зураг
    ? <img src={t.image} alt="" className={cn('flex-none object-cover', className)} />
    : <div className={cn('grid flex-none place-items-center', className)}>{moodById(t.mood).emoji}</div>;
}

function useLike() {
  const tr = useT();
  const { feedback, setFeedback, likedSongs, toggleLike } = useApp();
  const { nowId, current: t } = usePlayer();
  const songId = t?.uri?.split(':')[2];
  const liked = songId ? likedSongs.some(s => s.video_id === songId) : nowId ? feedback[nowId] === 1 : false;
  const toggle = () => {
    if (!nowId || !t) return;
    if (songId) toggleLike({ video_id: songId, title: t.title, artist: t.artist, thumbnail: t.image ?? null, duration_s: Math.round(t.dur) });
    else setFeedback(nowId, liked ? 0 : 1);
    toast(liked ? tr('Хасагдлаа') : tr('Таалагдсан дуунд нэмэгдлээ 💚'));
  };
  return { liked, toggle };
}

/* ---------- Mini player (Spotify маягийн) ---------- */
export function MiniPlayer() {
  const tr = useT();
  const p = usePlayer();
  const { liked, toggle: like } = useLike();
  useTicker(Boolean(p.current) && p.playing);
  const t = p.current; if (!t || p.usesEmbed) return null; // embed үед Spotify-ийн өөрийн тоглуулагч харагдана
  const m = moodById(t.mood);
  return (
    <div role="region" aria-label={tr('Тоглуулагч')} onClick={() => p.setFull(true)}
      className="mini fixed inset-x-2 z-35 flex h-16 cursor-pointer items-center gap-2.5 overflow-hidden rounded-2xl p-2 text-white shadow-[0_10px_30px_rgba(0,0,0,.3)]"
      style={{ '--pc': m.color } as React.CSSProperties}>
      <Cover t={t} className="mini-cover size-12 rounded-[10px] text-2xl" />
      <div className="min-w-0 flex-1">
        <b className="block truncate text-sm">{t.title}</b>
        <span className="flex items-center gap-1.5 truncate text-xs opacity-75">{p.playing && <Eq className="text-spotify" />}{t.artist}</span>
      </div>
      <button className="grid size-[42px] flex-none place-items-center rounded-full text-lg" aria-label={tr('Таалагдсан')} onClick={e => { e.stopPropagation(); like(); }}>{liked ? '💚' : '♡'}</button>
      <button className="grid size-[42px] flex-none place-items-center rounded-full bg-white text-lg text-[#1A1816]" aria-label={p.playing ? tr('Түр зогсоох') : tr('Тоглуулах')}
        onClick={e => { e.stopPropagation(); p.toggle(); }}>{p.playing ? '❚❚' : '▶'}</button>
      <div className="absolute inset-x-3 bottom-[3px] h-[3px] rounded-sm bg-white/20">
        <i className="block h-full rounded-sm bg-white" style={{ width: `${Math.min(100, (p.elapsed() / (p.duration() || 1)) * 100)}%` }} />
      </div>
    </div>
  );
}

/* ---------- Бүтэн дэлгэцийн player ---------- */
export function FullPlayer() {
  const tr = useT();
  const p = usePlayer();
  const { liked, toggle: like } = useLike();
  const [drag, setDrag] = useState<number | null>(null);
  useTicker(p.full && p.playing);
  const { setFull } = p;

  useEffect(() => {
    if (!p.full) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false); };
    addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; removeEventListener('keydown', onKey); };
  }, [p.full, setFull]);

  const t = p.current; if (!t || !p.full) return null;
  const m = moodById(t.mood), e = drag ?? p.elapsed(), dur = p.duration(), url = spotifyTrackUrl(t.uri);
  return (
    <div role="dialog" aria-modal="true" aria-label={tr('Тоглуулж буй дуу')}
      className={cn('fp fixed inset-0 z-55 flex flex-col overflow-y-auto text-white', p.playing && 'playing')} style={{ '--pc': m.color } as React.CSSProperties}>
      <div className="flex items-center justify-between">
        <button className="grid size-11 place-items-center text-2xl" aria-label={tr('Хураах')} onClick={() => p.setFull(false)}>⌄</button>
        <span className="text-sm opacity-80">«{tr(m.label)}» playlist</span><span className="w-11" />
      </div>
      <div className="fp-art mx-auto mt-4.5 mb-5.5 grid aspect-square w-[min(78vw,320px)] place-items-center overflow-hidden rounded-3xl desk:w-[200px]">
        {t.image
          // eslint-disable-next-line @next/next/no-img-element -- Spotify CDN-ийн зураг
          ? <img src={t.image.replace(/ab67616d00004851/, 'ab67616d00001e02')} alt="" className="size-full object-cover" />
          : <MoodFace m={m} className="size-[46%] text-[7rem]" />}
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><h2 className="m-0 truncate text-[1.35rem] font-bold">{t.title}</h2><p className="m-0 opacity-75">{t.artist}</p></div>
        <button className="grid size-11 flex-none place-items-center text-2xl" aria-label={tr('Таалагдсан')} onClick={like}>{liked ? '💚' : '♡'}</button>
      </div>
      <input type="range" min={0} max={Math.max(1, Math.floor(dur))} step={1} value={Math.floor(e)} aria-label={tr('Явц')} className="mt-3.5 h-8 w-full accent-white"
        onChange={ev => setDrag(+ev.target.value)}
        onPointerUp={ev => { p.seek(+(ev.target as HTMLInputElement).value); setDrag(null); }}
        onKeyUp={ev => { p.seek(+(ev.target as HTMLInputElement).value); setDrag(null); }} />
      <div className="-mt-1 flex justify-between text-xs opacity-70"><span>{fmtSec(e)}</span><span>{fmtSec(dur)}</span></div>
      <div className="my-3.5 mb-5 flex items-center justify-center gap-7">
        <button className="grid size-11 place-items-center text-2xl" aria-label={tr('Өмнөх')} onClick={() => p.skip(-1)}>⏮</button>
        <button className="grid size-[68px] place-items-center rounded-full bg-white text-2xl text-[#1A1816]" aria-label={tr('Тоглуулах/зогсоох')} onClick={p.toggle}>{p.playing ? '❚❚' : '▶'}</button>
        <button className="grid size-11 place-items-center text-2xl" aria-label={tr('Дараах')} onClick={() => p.skip(1)}>⏭</button>
      </div>
      <div>
        <h3 className="mb-1 text-[.95rem] font-semibold opacity-90">{tr('Дараалал')}</h3>
        {p.queue.map((q, i) => {
          const qm = moodById(q.mood), now = i === p.idx;
          return (
            <button key={q.id + i} onClick={() => p.jump(i)} className="flex w-full items-center gap-3 py-2 text-left">
              <span className="grid size-[42px] flex-none place-items-center rounded-lg" style={{ background: qm.color }}>{now && p.playing ? <Eq className="text-[#1A1816]" /> : qm.emoji}</span>
              <span className="min-w-0 flex-1"><b className={cn('block truncate', now && 'text-spotify')}>{q.title}</b><span className="block truncate text-xs opacity-65">{q.artist}</span></span>
              <span className="text-sm">{fmtSec(q.dur)}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[.72rem] opacity-55">
        {t.source === 'spotify'
            ? p.usesYt ? tr('YouTube-ээр бүтэн тоглож байна.') : p.usesEmbed ? tr('Апп дотор 30 орчим секундын хэсэг тоглоно. Бүтэн сонсох бол доорх холбоосыг дарна уу.') : tr('Spotify Premium-ээр апп дотроо тоглож байна.')
            : tr('Демо: дууны оронд тухайн mood-ийн аялгууг браузер дээр үүсгэж тоглуулж байна.')}
      </p>
      {url && <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1 text-center text-sm font-semibold underline">{tr('Spotify-д бүтэн сонсох ↗')}</a>}
    </div>
  );
}
