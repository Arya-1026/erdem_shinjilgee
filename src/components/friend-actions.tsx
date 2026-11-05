'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { socialError, type Person } from '@/lib/social';
import type { MenuItem } from './action-menu';
import { useApp } from './providers/app-provider';

type Target = Person & { favorite?: boolean; mood_hidden?: boolean; archived?: boolean };

/* Найз дээрх үйлдлүүд: зурвас, favorite, mood харуулах/нуух, архив, түүх устгах, unfriend, блок.
   Профайлын найзын жагсаалт болон Найзууд хуудас хоёулаа ашиглана. */
export function useFriendActions(reload: () => void) {
  const { supabase } = useApp();
  const router = useRouter();

  const act = useCallback(async (p: PromiseLike<{ error: unknown }>, ok: string) => {
    const { error } = await p;
    if (error) return void toast.error(socialError(error as Error));
    toast(ok);
    reload();
  }, [reload]);

  return useCallback((p: Target, o: { isFriend: boolean; chat?: boolean }): MenuItem[] => [
    { label: '💬 Зурвас бичих', onSelect: () => router.push(`/friends/${p.id}`) },
    o.isFriend && { label: p.favorite ? '☆ Favorite-оос хасах' : '⭐ Favorite болгох',
      onSelect: () => void act(supabase.rpc('set_favorite', { target: p.id, favorite: !p.favorite }), p.favorite ? 'Favorite-оос хаслаа' : `${p.name} favorite боллоо ⭐`) },
    o.isFriend && { label: p.mood_hidden ? '🙂 Миний mood-ыг харуулах' : '🙈 Миний mood-ыг нуух',
      onSelect: () => void act(supabase.rpc('set_mood_hidden', { target: p.id, hidden: !p.mood_hidden }), p.mood_hidden ? `${p.name} таны сэтгэл санааг харна` : `${p.name}-аас сэтгэл санаагаа нууллаа 🙈`) },
    o.chat && { label: p.archived ? '📤 Архиваас гаргах' : '🗄️ Архивлах',
      onSelect: () => void act(supabase.rpc('set_chat_archived', { partner: p.id, archived: !p.archived }), p.archived ? 'Архиваас гаргалаа' : 'Архивлалаа. Шинэ зурвас ирвэл дахин гарч ирнэ.') },
    o.chat && { label: '🗑️ Ярианы түүх устгах', danger: true,
      onSelect: () => { if (confirm('Энэ ярианы түүхийг өөрөөсөө устгах уу? Нөгөө хүнд хэвээр үлдэнэ.')) void act(supabase.rpc('delete_chat', { partner: p.id }), 'Ярианы түүх устлаа'); } },
    o.isFriend && { label: '👋 Unfriend (найзаас хасах)', danger: true,
      onSelect: () => { if (confirm(`${p.name}-г найзаас хасах уу?`)) void act(supabase.rpc('remove_friend', { target: p.id }), 'Найзаас хаслаа'); } },
    { label: '🚫 Блоклох', danger: true,
      onSelect: () => { if (confirm(`${p.name}-г блоклох уу? Тэр танд бичих, таныг хайж олох боломжгүй болно.`)) void act(supabase.rpc('block_user', { target: p.id }), 'Блоклолоо'); } },
  ], [act, router, supabase]);
}
