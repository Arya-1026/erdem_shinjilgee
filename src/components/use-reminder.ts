'use client';

import { useEffect } from 'react';
import { today } from '@/lib/date';
import { showLocal } from '@/lib/push-client';
import { useApp } from './providers/app-provider';
import { useT } from '@/components/providers/locale-provider';

const KEY = 'setgel_reminded';

/* Апп нээлттэй үед сануулгын цаг болоход энэ төхөөрөмж дээр шууд мэдэгдэнэ (сервер рүү хамааралгүй нөөц) */
export function useReminder() {
  const tr = useT();
  const { profile, entries } = useApp();
  const { reminder_enabled: on, reminder_time: time } = profile;
  const logged = entries.some(e => e.entry_date === today());

  useEffect(() => {
    if (!on || logged) return;
    const check = () => {
      const now = new Date(), d = today();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (hhmm < time.slice(0, 5) || localStorage.getItem(KEY) === d) return;
      localStorage.setItem(KEY, d);
      void showLocal(tr('Өнөөдөр ямар байна? 🌙'), tr('Сэтгэл санаагаа 10 секундэд тэмдэглээрэй.'), 'reminder');
    };
    check();
    const t = setInterval(check, 30_000);
    return () => clearInterval(t);
  }, [on, time, logged, tr]);
}
