'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PersonAvatar } from '@/components/person-avatar';
import { useApp } from '@/components/providers/app-provider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { moodById } from '@/lib/data';
import { today } from '@/lib/date';
import { moodAgo, shortId, social, socialError, type Person, type UserCard } from '@/lib/social';
import { useT } from '@/components/providers/locale-provider';

/* Хүний профайл: харилцаа (найз нэмэх, хасах, блок), сэтгэл санаа, найзууд. Зурвас бичих боломжгүй. */
export default function PersonPage() {
  const tr = useT();
  const { id } = useParams<{ id: string }>();
  const { supabase, profile } = useApp();
  const router = useRouter();
  const [card, setCard] = useState<UserCard | null | undefined>(undefined);
  const [friends, setFriends] = useState<Person[]>([]);
  const [now] = useState(today);

  const load = useCallback(async () => {
    try {
      const c = await social.card(supabase, id);
      setCard(c);
      setFriends(c?.friends_visible && c.relation !== 'self' ? await social.userFriends(supabase, id) : []);
    } catch { setCard(null); }
  }, [supabase, id]);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);
  // Өөрийнхөө ID-г нээвэл профайл руу
  useEffect(() => { if (card?.relation === 'self') router.replace('/profile'); }, [card, router]);

  const act = async (p: PromiseLike<{ error: unknown }>, ok: string) => {
    const { error } = await p;
    if (error) return void toast.error(tr(socialError(error as Error)));
    toast(ok);
    void load();
  };

  if (card === undefined) return <p className="py-10 text-center text-muted-foreground">{tr('Ачаалж байна…')}</p>;
  if (!card) return (
    <div className="card-x mx-auto max-w-[520px] text-center">
      <p className="mb-3">{tr('Хэрэглэгч олдсонгүй.')}</p>
      <Link href="/home" className="font-semibold text-primary">{tr('← Нүүр рүү буцах')}</Link>
    </div>
  );
  if (card.relation === 'self') return null;

  const m = card.mood ? moodById(card.mood) : null;
  const block = () => {
    if (!confirm(tr('{0}-г блоклох уу? Тэр таныг хайж олох, сэтгэл санааг тань харах боломжгүй болно.', card.name))) return;
    void act(supabase.rpc('block_user', { target: card.id }), tr('Блоклолоо')).then(() => router.push('/home'));
  };

  return (
    <div className="mx-auto max-w-[560px]">
      <section className="card-x flex flex-col gap-3">
        <Link href="/home" className="text-sm font-semibold text-primary">{tr('← Нүүр')}</Link>
        <div className="flex items-center gap-3.5">
          <PersonAvatar name={card.name} avatar={card.avatar} mood={card.mood} className="size-16 text-2xl" />
          <div className="min-w-0">
            <h2 className="truncate text-[1.15rem] font-bold">{card.name}</h2>
            <p className="text-sm text-muted-foreground">{card.handle ? `@${card.handle} · ` : ''}ID {shortId(card.id)}{card.is_private ? ' · 🔒' : ''}</p>
          </div>
        </div>

        <div className="rounded-2xl bg-secondary/60 p-3 text-sm">
          {m ? <><span className="text-2xl">{m.emoji}</span> <b>{tr(m.label)}</b> <span className="text-muted-foreground">· {moodAgo(card.mood_date, now, tr)}</span></>
            : <span className="text-muted-foreground">{tr('🔒 Сэтгэл санаа нь танд харагдахгүй байна')}</span>}
        </div>

        {/* Ерөнхий нууцлалаас гадна тухайн хүнээс сэтгэл санаагаа нууж болно */}
        <label className="flex items-center justify-between gap-3 rounded-2xl border p-3 text-sm">
          <span><b className="block">{tr('Миний сэтгэл санааг харуулах')}</b><span className="text-muted-foreground">{card.mood_hidden ? tr('{0}-аас нуусан', card.name) : tr('{0} таны сүүлийн бүртгэлийг харж болно (профайлын тохиргооны дагуу)', card.name)}</span></span>
          <Switch checked={!card.mood_hidden} aria-label={tr('Миний сэтгэл санааг харуулах')}
            onCheckedChange={v => void act(supabase.rpc('set_mood_hidden', { target: card.id, hidden: !v }), v ? tr('Сэтгэл санаагаа харууллаа') : tr('Сэтгэл санаагаа нууллаа 🙈'))} />
        </label>

        <div className="flex flex-wrap gap-2">
          {card.relation === 'none' && <Button onClick={() => void act(supabase.rpc('send_friend_request', { target: card.id }), tr('Найзын хүсэлт илгээлээ 📨'))}>{tr('＋ Найз нэмэх')}</Button>}
          {card.relation === 'incoming' && <>
            <Button onClick={() => void act(supabase.rpc('respond_friend_request', { from_user: card.id, accept: true }), tr('{0} найз боллоо 🎉', card.name))}>{tr('Хүсэлт зөвшөөрөх')}</Button>
            <Button variant="outline" onClick={() => void act(supabase.rpc('respond_friend_request', { from_user: card.id, accept: false }), tr('Татгалзлаа'))}>{tr('Татгалзах')}</Button>
          </>}
          {card.relation === 'outgoing' && <Button variant="outline" onClick={() => void act(supabase.rpc('remove_friend', { target: card.id }), tr('Хүсэлтээ цуцаллаа'))}>{tr('Хүсэлт цуцлах')}</Button>}
          {card.relation === 'friend' && <Button variant="outline" onClick={() => { if (confirm(tr('{0}-г найзаас хасах уу?', card.name))) void act(supabase.rpc('remove_friend', { target: card.id }), tr('Найзаас хаслаа')); }}>{tr('Найзаас хасах')}</Button>}
          <Button variant="ghost" className="text-destructive" onClick={block}>{tr('🚫 Блоклох')}</Button>
        </div>

        <div>
          <h3 className="mb-1 text-sm font-semibold">{tr('Найзууд{0}', card.friends_count != null && ` · ${card.friends_count}`)}</h3>
          {!card.friends_visible ? <p className="text-sm text-muted-foreground">{tr('🔒 Найзуудаа нуусан байна')}</p>
            : !friends.length ? <p className="text-sm text-muted-foreground">{tr('Харуулах найз алга')}</p>
            : (
              <div className="flex flex-wrap gap-2">
                {friends.slice(0, 24).map(f => (
                  <Link key={f.id} href={f.id === profile.id ? '/profile' : `/friends/${f.id}`} title={f.name} className="flex items-center gap-1.5 rounded-full border bg-card py-1 pr-3 pl-1 text-sm">
                    <PersonAvatar name={f.name} avatar={f.avatar} className="size-7 text-xs" />{f.name}
                  </Link>
                ))}
              </div>
            )}
        </div>
      </section>

    </div>
  );
}

