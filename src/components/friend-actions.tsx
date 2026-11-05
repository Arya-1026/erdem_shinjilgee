'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { socialError, type Person } from '@/lib/social';
import type { MenuItem } from './action-menu';
import { useApp } from './providers/app-provider';

type Target = Person & { favorite?: boolean; mood_hidden?: boolean };

/* Найз дээрх үйлдлүүд (профайлын «Найзууд» цонх): favorite, mood харуулах/нуух, unfriend, блок. Зурвас бичих боломжгүй. */
export function useFriendActions(reload: () => void) {
  const { supabase } = useApp();

  const act = useCallback(async (p: PromiseLike<{ error: unknown }>, ok: string) => {
    const { error } = await p;
    if (error) return void toast.error(socialError(error as Error));
    toast(ok);
    reload();
  }, [reload]);

  return useCallback((p: Target, o: { isFriend: boolean }): MenuItem[] => [
    o.isFriend && { label: p.favorite ? '☆ Favorite-оос хасах' : '⭐ Favorite болгох',
      onSelect: () => void act(supabase.rpc('set_favorite', { target: p.id, favorite: !p.favorite }), p.favorite ? 'Favorite-оос хаслаа' : `${p.name} favorite боллоо ⭐`) },
    o.isFriend && { label: p.mood_hidden ? '🙂 Миний mood-ыг харуулах' : '🙈 Миний mood-ыг нуух',
      onSelect: () => void act(supabase.rpc('set_mood_hidden', { target: p.id, hidden: !p.mood_hidden }), p.mood_hidden ? `${p.name} таны сэтгэл санааг харна` : `${p.name}-аас сэтгэл санаагаа нууллаа 🙈`) },
    o.isFriend && { label: '👋 Unfriend (найзаас хасах)', danger: true,
      onSelect: () => { if (confirm(`${p.name}-г найзаас хасах уу?`)) void act(supabase.rpc('remove_friend', { target: p.id }), 'Найзаас хаслаа'); } },
    { label: '🚫 Блоклох', danger: true,
      onSelect: () => { if (confirm(`${p.name}-г блоклох уу? Тэр таныг хайж олох, сэтгэл санааг тань харах боломжгүй болно.`)) void act(supabase.rpc('block_user', { target: p.id }), 'Блоклолоо'); } },
  ], [act, supabase]);
}
