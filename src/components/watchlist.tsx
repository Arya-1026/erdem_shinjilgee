'use client';

import { toast } from 'sonner';
import type { Mood } from '@/lib/types';
import { useT } from './providers/locale-provider';
import { useApp } from './providers/app-provider';
import { RecTile } from './rec-tiles';
import { useWatched, useWatchlistMovies } from './use-movies';

/* «📌 Үзэх жагсаалт»: «Дэлгэрэнгүй» цонхноос нэмсэн кинонууд. Үзсэн эсвэл хассан кино жагсаалтаас гарна. */
export function Watchlist({ mood, showEmpty }: { mood: Mood; showEmpty?: boolean }) {
  const tr = useT();
  const { toggleWatch } = useApp();
  const { markWatched } = useWatched();
  const movies = useWatchlistMovies(mood.id);
  if (!movies || (!movies.length && !showEmpty)) return null;

  const watched = async (id: string, title: string) => {
    markWatched(id);
    await toggleWatch(id);
    toast(tr('«{0}» үзсэнд тэмдэглэгдлээ 🎬', title));
  };
  const remove = async (id: string) => { await toggleWatch(id); toast(tr('Жагсаалтаас хасагдлаа')); };

  return (
    <section id="watchlist" className="card-x mb-3.5 scroll-mt-24">
      <h2 className="font-bold">{tr('📌 Үзэх жагсаалт')} <span className="font-normal text-muted-foreground">· {movies.length}</span></h2>
      {movies.length ? (
        <div className="hscroll mt-2.5">
          {movies.map(r => (
            <div key={r.id} className="flex w-[132px] flex-none snap-start flex-col gap-1.5">
              <RecTile r={r} m={mood} />
              <div className="flex gap-1.5">
                <button className="h-9 flex-1 rounded-[10px] border-[1.5px] text-xs font-semibold" onClick={() => void watched(r.id, r.title)}>{tr('✓ Үзсэн')}</button>
                <button className="h-9 flex-1 rounded-[10px] border-[1.5px] text-xs text-muted-foreground" aria-label={tr('{0}-г жагсаалтаас хасах', r.title)} onClick={() => void remove(r.id)}>{tr('Хасах')}</button>
              </div>
            </div>
          ))}
        </div>
      ) : <p className="mt-1 text-sm text-muted-foreground">{tr('Кино дээр дараад «＋ Үзэх жагсаалтад нэмэх» товчоор нэмээрэй.')}</p>}
    </section>
  );
}
