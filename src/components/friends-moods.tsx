'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Avatar } from '@/components/avatar';
import { FriendsSheet } from '@/components/friends-tile';
import { MoodHalo, NoteBubble } from '@/components/note-bubble';
import { NoteEditor } from '@/components/note-editor';
import { PersonAvatar } from '@/components/person-avatar';
import { useApp } from '@/components/providers/app-provider';
import { useT } from '@/components/providers/locale-provider';
import { today } from '@/lib/date';
import { moodAgo, noteLive, social, type FriendRow } from '@/lib/social';

const firstName = (n: string) => n.split(/[\s.]+/).filter(Boolean).pop() ?? n;

/* Нүүр хуудас: найзууд маань ямар сэтгэл санаатай байна (аватарын дээрх бөмбөлөг).
   Чат, зурвас байхгүй. Найз нэмэх, хүсэлт, блок нь профайлын «Найзууд» цонхонд. */
export function FriendsMoods() {
  const tr = useT();
  const { supabase, profile, entries } = useApp();
  const [friends, setFriends] = useState<FriendRow[] | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [now] = useState(() => Date.now());

  const load = useCallback(async () => {
    try { setFriends(await social.friends(supabase)); } catch { setFriends([]); }
  }, [supabase]);
  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    const id = setInterval(() => { if (!document.hidden) void load(); }, 60_000);
    return () => { clearTimeout(t); clearInterval(id); };
  }, [load]);

  const myNote = noteLive(profile.note_at, now);
  const last = entries.at(-1);
  const myMood = (myNote ? profile.note_mood : null) ?? last?.mood ?? null;
  const mySub = (myNote ? profile.note_text : null) || (last ? moodAgo(last.entry_date, today()) : null);
  // Сэтгэл санаа нь харагддаг найзууд эхэнд, дараа нь favorite
  const list = [...(friends ?? [])].sort((a, b) => Number(!!(b.note_mood ?? b.mood)) - Number(!!(a.note_mood ?? a.mood)) || Number(b.favorite) - Number(a.favorite));

  return (
    <section className="card-x mt-4" aria-labelledby="friends-moods">
      <div className="flex items-center justify-between gap-2">
        <h3 id="friends-moods" className="font-semibold">{tr('👥 Найзууд маань ямар байна?')}</h3>
        <button type="button" className="text-sm font-semibold text-primary" onClick={() => setSheet(true)}>{tr('Найзууд')}</button>
      </div>
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pt-[50px] pb-1 no-scrollbar">
        {/* Өөрийн аватар дээр дарж бодол (Messenger-ийн Note шиг) хуваалцана */}
        <button type="button" onClick={() => setNoteOpen(true)} aria-label={myNote ? tr('Бодлоо засах') : tr('Бодол хуваалцах')}
          className="flex w-[88px] flex-none flex-col items-center gap-1 text-center">
          <span className="relative">
            <NoteBubble mood={myMood} sub={mySub} placeholder={tr('＋ Бодол…')} />
            <MoodHalo mood={myMood}><Avatar className="size-14 text-xl ring-2 ring-card" /></MoodHalo>
          </span>
          <span className="w-full truncate text-xs text-muted-foreground">{tr('Та')}</span>
        </button>
        {list.map(f => {
          const fm = f.note_mood ?? f.mood;
          return (
            <Link key={f.id} href={`/friends/${f.id}`} className="flex w-[88px] flex-none flex-col items-center gap-1 text-center">
              <span className="relative">
                {/* Сэтгэл санаагаа нуусан найзад бөмбөлөг огт харуулахгүй */}
                {fm && <NoteBubble mood={fm} sub={f.note_text || moodAgo(f.mood_date, today())} />}
                <MoodHalo mood={fm}><PersonAvatar name={f.name} avatar={f.avatar} className="size-14 text-xl ring-2 ring-card" /></MoodHalo>
              </span>
              <span className="w-full truncate text-xs">{f.favorite && '⭐ '}{firstName(f.name)}</span>
            </Link>
          );
        })}
        {friends !== null && !friends.length && (
          <button type="button" onClick={() => setSheet(true)} className="flex w-[88px] flex-none flex-col items-center gap-1 text-center">
            <span className="grid size-[72px] place-items-center rounded-full border-2 border-dashed border-primary text-2xl text-primary">＋</span>
            <span className="w-full truncate text-xs text-primary">{tr('Найз нэмэх')}</span>
          </button>
        )}
      </div>
      {noteOpen && <NoteEditor open onOpenChange={setNoteOpen} />}
      <FriendsSheet open={sheet} tab="friends" onOpenChange={o => { setSheet(o); if (!o) void load(); }} />
    </section>
  );
}
