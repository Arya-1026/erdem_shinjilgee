import { moodById } from '@/lib/data';
import type { MoodId } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Өөр хүний профайл зураг (нууцлалаас болж байхгүй бол нэрийн эхний үсэг), сүүлийн mood-ийн эможи буланд нь */
export function PersonAvatar({ name, avatar, mood, className }: { name: string; avatar: string | null; mood?: MoodId | null; className?: string }) {
  return (
    <span className={cn('relative grid flex-none place-items-center rounded-full bg-[linear-gradient(135deg,var(--primary),var(--primary-2))] font-bold text-white', className)}>
      {avatar
        // eslint-disable-next-line @next/next/no-img-element -- data URL
        ? <img src={avatar} alt="" className="size-full rounded-full object-cover" />
        : name[0] || '?'}
      {mood && <span className="absolute -right-1 -bottom-1 grid size-[45%] min-w-5 place-items-center rounded-full bg-card text-[clamp(.7rem,40%,1.2rem)] leading-none shadow" title={moodById(mood).label}>{moodById(mood).emoji}</span>}
    </span>
  );
}
