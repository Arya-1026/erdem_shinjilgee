'use client';

import type { SupabaseClient } from '@supabase/supabase-js';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { social } from '@/lib/social';

/** Цэсний «Найзууд» дээрх тоо: ирсэн хүсэлт + уншаагүй зурвас. 30 секунд тутам, хуудас солигдоход шинэчилнэ.
 *  Мөн найзуудад «идэвхтэй» (ногоон цэг) харагдахын тулд сүүлд идэвхтэй байсан цагийг тэмдэглэнэ. */
export function useSocialBadge(db: SupabaseClient) {
  const [n, setN] = useState(0);
  const path = usePathname();
  useEffect(() => {
    let alive = true;
    const load = () => {
      void db.rpc('touch_presence').then(() => {}, () => {});
      social.counts(db).then(c => { if (alive) setN(c.incoming + c.unread); }).catch(() => {});
    };
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, [db, path]);
  return n;
}
