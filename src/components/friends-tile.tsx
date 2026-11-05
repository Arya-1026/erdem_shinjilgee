'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { moodById } from '@/lib/data';
import { social, type FriendRow } from '@/lib/social';
import { ActionMenu } from './action-menu';
import { useFriendActions } from './friend-actions';
import { PersonAvatar } from './person-avatar';
import { useApp } from './providers/app-provider';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog';

/* Профайлын Бүртгэл/Дасгал/Streak-ийн хажууд «Найзууд» тоо. Дарахад найзуудын жагсаалт нээгдэж,
   найз бүр дээр: зурвас, favorite, mood харуулах/нуух, unfriend, блок. */
export function FriendsTile() {
  const { supabase } = useApp();
  const [list, setList] = useState<FriendRow[] | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => { social.friends(supabase).then(setList).catch(() => setList([])); }, [supabase]);
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t); }, [load]);
  const actions = useFriendActions(load);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded-2xl border bg-card p-3.5 text-left transition hover:border-primary">
        <span className="text-xs text-muted-foreground">Найзууд</span>
        <b className="block text-[1.4rem]">{list ? list.length : '–'}</b>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] grid-cols-[minmax(0,1fr)] overflow-auto sm:max-w-[460px]">
          <DialogTitle className="pr-10 text-base font-bold">👥 Найзууд{list?.length ? ` · ${list.length}` : ''}</DialogTitle>
          <DialogDescription className="sr-only">Найз дээр ⋯ дарж зурвас, favorite, mood, unfriend, блок сонгоно</DialogDescription>
          {!list ? <p className="py-4 text-center text-sm text-muted-foreground">Ачаалж байна…</p>
            : !list.length ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Одоогоор найз алга. <Link href="/friends?tab=search" className="font-semibold text-primary">Найз хайх →</Link></p>
            ) : (
              <div>
                {list.map(f => (
                  <div key={f.id} className="flex items-center gap-1 border-b last:border-0">
                    <Link href={`/friends/${f.id}`} className="flex min-w-0 flex-1 items-center gap-3 py-2.5" onClick={() => setOpen(false)}>
                      <PersonAvatar name={f.name} avatar={f.avatar} mood={f.mood} className="size-11" />
                      <span className="min-w-0">
                        <b className="block truncate">{f.favorite && '⭐ '}{f.name}{f.mood_hidden && <span className="ml-1 text-xs" title="Та энэ хүнээс сэтгэл санаагаа нуусан">🙈</span>}</b>
                        <span className="block truncate text-sm text-muted-foreground">{f.handle ? `@${f.handle}` : ''}{f.mood ? `${f.handle ? ' · ' : ''}${moodById(f.mood).emoji} ${moodById(f.mood).label}` : ''}</span>
                      </span>
                    </Link>
                    <ActionMenu items={actions(f, { isFriend: true })} label={`${f.name}: үйлдэл`} />
                  </div>
                ))}
              </div>
            )}
          <Link href="/friends" className="text-center text-sm font-semibold text-primary" onClick={() => setOpen(false)}>Найзууд хуудас руу →</Link>
        </DialogContent>
      </Dialog>
    </>
  );
}
