'use client';

import { Bell } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { SHEET } from '@/components/dialogs/dialog-host';
import { IncomingRequests } from '@/components/friends-tile';
import { useApp } from '@/components/providers/app-provider';
import { useT } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { addDays, hhmm, today, ymd } from '@/lib/date';
import { buildNotices, unseenCount, type Notice } from '@/lib/notifications';
import { pushSupported, showLocal, subscribePush } from '@/lib/push-client';
import { social, type RequestRow } from '@/lib/social';

const KEY = 'setgel_seen_notices';
const readSeen = () => {
  try { return new Set<string>(JSON.parse(localStorage.getItem(KEY) ?? '[]')); } catch { return new Set<string>(); }
};

/* Дээд мөрийн хонх: шинэ мэдэгдлүүд, найзын хүсэлтийг шууд хүлээн авах, цуцлах */
export function NotificationBell() {
  const tr = useT();
  const { supabase, profile, entries, todos, bookings } = useApp();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [chats, setChats] = useState<{ id: string; name: string; unread: number }[]>([]);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [now, setNow] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const [r, f] = await Promise.allSettled([social.requests(supabase), social.friends(supabase)]);
    setNow(new Date());
    if (r.status === 'fulfilled') setRequests(r.value.filter(x => x.direction === 'incoming'));
    if (f.status === 'fulfilled') setChats(f.value.map(x => ({ id: x.id, name: x.name, unread: x.unread })));
  }, [supabase]);

  useEffect(() => {
    const t = setTimeout(() => { setSeen(readSeen()); void load(); }, 0);
    const id = setInterval(() => { if (!document.hidden) void load(); }, 30_000);
    return () => { clearTimeout(t); clearInterval(id); };
  }, [load, path]);

  // Бодит цагт: хүсэлт ирэх, хариу авахад хонх шууд шинэчлэгдэж, апп дотор мэдэгдэнэ
  useEffect(() => {
    const onRow = (p: { eventType: string; new: { requester?: string; addressee?: string; status?: string } }) => {
      void load();
      const incoming = p.eventType === 'INSERT' && p.new.addressee === profile.id;
      const accepted = p.eventType === 'UPDATE' && p.new.requester === profile.id && p.new.status === 'accepted';
      if (!incoming && !accepted) return;
      const text = incoming ? tr('Танд шинэ найзын хүсэлт ирлээ 📨') : tr('Таны найзын хүсэлтийг зөвшөөрлөө 🎉');
      toast(text);
      if (document.hidden) void showLocal(tr('Сэтгэл 🌙'), text, 'friend');
    };
    const ch = supabase.channel(`notices:${profile.id}`);
    for (const filter of [`addressee=eq.${profile.id}`, `requester=eq.${profile.id}`])
      ch.on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter }, onRow);
    ch.subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [supabase, profile.id, load, tr]);

  // Зөвшөөрөл өгсөн төхөөрөмжийг энэ хаягт автоматаар бүртгэнэ: хаяг өөрчлөгдсөн, бүртгэл устсан үед ч push үргэлжилнэ
  useEffect(() => {
    if (!pushSupported()) return;
    const t = setTimeout(() => {
      setPerm(Notification.permission);
      if (Notification.permission === 'granted') void subscribePush(supabase);
    }, 0);
    return () => clearTimeout(t);
  }, [supabase]);

  const notices: Notice[] = now ? buildNotices({
    today: today(), tomorrow: ymd(addDays(now, 1)), now: hhmm(now),
    reminder: { on: profile.reminder_enabled, time: profile.reminder_time },
    entries, todos, bookings, chats,
  }) : [];
  const count = unseenCount(notices, seen, requests.length);

  function show(o: boolean) {
    setOpen(o);
    if (!o) return;
    void load();
    const next = new Set(notices.map(n => n.id));
    setSeen(next);
    try { localStorage.setItem(KEY, JSON.stringify([...next])); } catch { /* хувийн горим */ }
  }

  async function enable() {
    const r = await subscribePush(supabase);
    setPerm(Notification.permission);
    if (r === 'ok') { void showLocal(tr('Сэтгэл 🌙'), tr('Мэдэгдэл идэвхжлээ. Цаг болоход сануулна.'), 'test'); toast(tr('Мэдэгдэл идэвхжлээ 🔔')); }
    else if (r === 'error') toast.error(tr('Идэвхжүүлж чадсангүй'));
  }

  return (
    <>
      <button type="button" className="relative grid size-10 flex-none place-items-center rounded-full border bg-card" aria-label={count ? tr('Мэдэгдэл, {0} шинэ', count) : tr('Мэдэгдэл')} onClick={() => show(true)}>
        <Bell className="size-5" aria-hidden="true" />
        {count > 0 && <b className="absolute -top-1 -right-1 grid min-w-4.5 place-items-center rounded-full bg-primary px-1 text-[.62rem] leading-[1.15rem] text-primary-foreground">{count > 9 ? '9+' : count}</b>}
      </button>
      <Dialog open={open} onOpenChange={show}>
        <DialogContent className={SHEET}>
          <DialogTitle className="mb-1 pr-11 text-[1.15rem] leading-tight font-bold">{tr('Мэдэгдэл')}</DialogTitle>
          <DialogDescription className="sr-only">{tr('Шинэ мэдэгдлүүд, найзын хүсэлт')}</DialogDescription>
          {perm === 'default' && (
            <div className="mt-2 rounded-2xl bg-secondary p-3 text-sm">
              <p className="mb-2">{tr('Апп хаалттай үед ч сануулга, найзын хүсэлт ирэхийн тулд мэдэгдлээ асаана уу.')}</p>
              <Button size="sm" className="h-9 px-3" onClick={() => void enable()}>{tr('🔔 Мэдэгдэл асаах')}</Button>
            </div>
          )}
          {perm === 'denied' && <p className="mt-2 rounded-2xl bg-secondary p-3 text-sm">{tr('Браузерын тохиргооноос мэдэгдлийг зөвшөөрнө үү')}</p>}
          <div className="mt-2.5 flex flex-col gap-2.5">
            <IncomingRequests list={requests} onDone={() => void load()} onGo={() => setOpen(false)} />
            {notices.map(n => (
              <Link key={n.id} href={n.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-2xl border bg-card p-3 text-sm">
                <span className="text-xl" aria-hidden="true">{n.icon}</span>
                <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{tr(n.text, ...n.args)}</span>
              </Link>
            ))}
            {!requests.length && !notices.length && <p className="py-6 text-center text-sm text-muted-foreground">{tr('Шинэ мэдэгдэл алга')}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
