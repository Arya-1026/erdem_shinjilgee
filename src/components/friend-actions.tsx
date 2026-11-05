'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { toast } from 'sonner';
import { socialError, type Person } from '@/lib/social';
import type { MenuItem } from './action-menu';
import { useApp } from './providers/app-provider';
import { useT } from '@/components/providers/locale-provider';

type Target = Person & { favorite?: boolean; mood_hidden?: boolean; archived?: boolean };

/* Найз дээрх үйлдлүүд: зурвас, favorite, mood харуулах/нуух, архив, түүх устгах, unfriend, блок.
   Профайлын найзын жагсаалт болон Найзууд хуудас хоёулаа ашиглана. */
export function useFriendActions(reload: () => void) {
  const tr = useT();
  const { supabase } = useApp();
  const router = useRouter();

  const act = useCallback(async (p: PromiseLike<{ error: unknown }>, ok: string) => {
    const { error } = await p;
    if (error) return void toast.error(tr(socialError(error as Error)));
    toast(ok);
    reload();
  }, [reload, tr]);

  return useCallback((p: Target, o: { isFriend: boolean; chat?: boolean }): MenuItem[] => [
    { label: tr('💬 Зурвас бичих'), onSelect: () => router.push(`/friends/${p.id}`) },
    o.isFriend && { label: p.favorite ? tr('☆ Favorite-оос хасах') : tr('⭐ Favorite болгох'),
      onSelect: () => void act(supabase.rpc('set_favorite', { target: p.id, favorite: !p.favorite }), p.favorite ? tr('Favorite-оос хаслаа') : tr('{0} favorite боллоо ⭐', p.name)) },
    o.isFriend && { label: p.mood_hidden ? tr('🙂 Миний mood-ыг харуулах') : tr('🙈 Миний mood-ыг нуух'),
      onSelect: () => void act(supabase.rpc('set_mood_hidden', { target: p.id, hidden: !p.mood_hidden }), p.mood_hidden ? tr('{0} таны сэтгэл санааг харна', p.name) : tr('{0}-аас сэтгэл санаагаа нууллаа 🙈', p.name)) },
    o.chat && { label: p.archived ? tr('📤 Архиваас гаргах') : tr('🗄️ Архивлах'),
      onSelect: () => void act(supabase.rpc('set_chat_archived', { partner: p.id, archived: !p.archived }), p.archived ? tr('Архиваас гаргалаа') : tr('Архивлалаа. Шинэ зурвас ирвэл дахин гарч ирнэ.')) },
    o.chat && { label: tr('🗑️ Ярианы түүх устгах'), danger: true,
      onSelect: () => { if (confirm(tr('Энэ ярианы түүхийг өөрөөсөө устгах уу? Нөгөө хүнд хэвээр үлдэнэ.'))) void act(supabase.rpc('delete_chat', { partner: p.id }), tr('Ярианы түүх устлаа')); } },
    o.isFriend && { label: tr('👋 Unfriend (найзаас хасах)'), danger: true,
      onSelect: () => { if (confirm(tr('{0}-г найзаас хасах уу?', p.name))) void act(supabase.rpc('remove_friend', { target: p.id }), tr('Найзаас хаслаа')); } },
    { label: tr('🚫 Блоклох'), danger: true,
      onSelect: () => { if (confirm(tr('{0}-г блоклох уу? Тэр танд бичих, таныг хайж олох боломжгүй болно.', p.name))) void act(supabase.rpc('block_user', { target: p.id }), tr('Блоклолоо')); } },
  ], [act, router, supabase, tr]);
}
