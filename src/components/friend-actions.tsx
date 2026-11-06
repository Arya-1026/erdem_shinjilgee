'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { socialError, type Person } from '@/lib/social';
import type { MenuItem } from './action-menu';
import { askConfirm } from './confirm-host';
import { useApp } from './providers/app-provider';
import { useT } from '@/components/providers/locale-provider';

type Target = Person & { favorite?: boolean; mood_hidden?: boolean };

/* Найз дээрх үйлдлүүд (профайлын «Найзууд» цонх): favorite, mood харуулах/нуух, unfriend, блок. Зурвас бичих боломжгүй. */
export function useFriendActions(reload: () => void) {
  const tr = useT();
  const { supabase } = useApp();

  const act = useCallback(async (p: PromiseLike<{ error: unknown }>, ok: string) => {
    const { error } = await p;
    if (error) return void toast.error(tr(socialError(error as Error)));
    toast(ok);
    reload();
  }, [reload, tr]);

  return useCallback((p: Target, o: { isFriend: boolean }): MenuItem[] => [
    o.isFriend && { label: p.favorite ? tr('☆ Favorite-оос хасах') : tr('⭐ Favorite болгох'),
      onSelect: () => void act(supabase.rpc('set_favorite', { target: p.id, favorite: !p.favorite }), p.favorite ? tr('Favorite-оос хаслаа') : tr('{0} favorite боллоо ⭐', p.name)) },
    o.isFriend && { label: p.mood_hidden ? tr('🙂 Миний mood-ыг харуулах') : tr('🙈 Миний mood-ыг нуух'),
      onSelect: () => void act(supabase.rpc('set_mood_hidden', { target: p.id, hidden: !p.mood_hidden }), p.mood_hidden ? tr('{0} таны сэтгэл санааг харна', p.name) : tr('{0}-аас сэтгэл санаагаа нууллаа 🙈', p.name)) },
    o.isFriend && { label: tr('👋 Unfriend (найзаас хасах)'), danger: true,
      onSelect: () => void askConfirm(tr('{0}-г найзаас хасах уу?', p.name), tr('Хасах')).then(ok => { if (ok) void act(supabase.rpc('remove_friend', { target: p.id }), tr('Найзаас хаслаа')); }) },
    { label: tr('🚫 Блоклох'), danger: true,
      onSelect: () => void askConfirm(tr('{0}-г блоклох уу? Тэр таныг хайж олох, сэтгэл санааг тань харах боломжгүй болно.', p.name), tr('🚫 Блоклох')).then(ok => { if (ok) void act(supabase.rpc('block_user', { target: p.id }), tr('Блоклолоо')); }) },
  ], [act, supabase, tr]);
}
