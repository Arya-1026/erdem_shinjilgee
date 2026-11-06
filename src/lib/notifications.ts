/* ---------- Хонхны цэсний мэдэгдлүүд ----------
   Одоо байгаа өгөгдлөөс шууд гаргана: хүсэлт, зурвас, ажил зэрэг шийдэгдэхэд мэдэгдэл өөрөө алга болно.
   Найзын хүсэлт нь үйлдэлтэй тул энд биш, цэсэнд тусад нь харагдана. */
import type { Booking, Entry, Todo } from './types';

/** text: орчуулах түлхүүр, args: {0}, {1}-ийн утга */
export type Notice = { id: string; icon: string; text: string; args: (string | number)[]; href: string };

type Input = {
  today: string;
  tomorrow: string;
  /** HH:MM */
  now: string;
  reminder: { on: boolean; time: string };
  entries: Pick<Entry, 'entry_date'>[];
  todos: Pick<Todo, 'planned_date' | 'done'>[];
  bookings: Pick<Booking, 'id' | 'booking_date' | 'slot' | 'status'>[];
  chats: { id: string; name: string; unread: number }[];
};

export function buildNotices(p: Input): Notice[] {
  const out: Notice[] = [];
  for (const c of p.chats) if (c.unread > 0) out.push({ id: `msg:${c.id}:${c.unread}`, icon: '💬', text: '{0}: {1} шинэ зурвас', args: [c.name, c.unread], href: `/friends/${c.id}` });
  for (const b of p.bookings) {
    if (b.status !== 'booked' || (b.booking_date !== p.today && b.booking_date !== p.tomorrow)) continue;
    out.push({ id: `book:${b.id}:${b.booking_date}`, icon: '🧑‍⚕️', text: b.booking_date === p.today ? 'Өнөөдөр {0}-д сэтгэл зүйчтэй уулзана' : 'Маргааш {0}-д сэтгэл зүйчтэй уулзана', args: [b.slot], href: '/experts' });
  }
  const work = p.todos.filter(t => !t.done && t.planned_date === p.today).length;
  if (work) out.push({ id: `todo:${p.today}:${work}`, icon: '🗓️', text: 'Өнөөдөр {0} ажил төлөвлөсөн', args: [work], href: '/todo' });
  if (p.reminder.on && p.now >= p.reminder.time.slice(0, 5) && !p.entries.some(e => e.entry_date === p.today))
    out.push({ id: `mood:${p.today}`, icon: '🌙', text: 'Өнөөдрийн сэтгэл санаагаа тэмдэглээрэй', args: [], href: '/home' });
  return out;
}

/** Хараагүй мэдэгдлийн тоо. Хариу хүлээж буй найзын хүсэлт үргэлж тоологдоно. */
export const unseenCount = (notices: Pick<Notice, 'id'>[], seen: Set<string>, requests: number) =>
  requests + notices.filter(n => !seen.has(n.id)).length;
