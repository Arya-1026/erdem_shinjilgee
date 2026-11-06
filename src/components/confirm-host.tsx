'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useT } from '@/components/providers/locale-provider';

type Ask = { text: string; yes: string; done: (ok: boolean) => void };
let show: ((a: Ask) => void) | null = null;

/** Апп доторх баталгаажуулалт. Хөтчийн confirm() зарим орчинд цонх харуулалгүй шууд false буцаадаг тул ашиглахгүй. */
export const askConfirm = (text: string, yes: string) => new Promise<boolean>(done => {
  if (show) show({ text, yes, done });
  else done(false);
});

export function ConfirmHost() {
  const tr = useT();
  const [ask, setAsk] = useState<Ask | null>(null);
  useEffect(() => { show = setAsk; return () => { show = null; }; }, []);
  const answer = (ok: boolean) => { ask?.done(ok); setAsk(null); };
  return (
    <Dialog open={Boolean(ask)} onOpenChange={o => { if (!o) answer(false); }}>
      <DialogContent className="max-w-[min(92vw,380px)] gap-3 p-5" showCloseButton={false}>
        <DialogTitle className="text-base leading-snug font-bold">{ask?.text}</DialogTitle>
        <DialogDescription className="sr-only">{tr('Баталгаажуулах')}</DialogDescription>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="xl" className="h-10" onClick={() => answer(false)}>{tr('Болих')}</Button>
          <Button variant="destructive" size="xl" className="h-10" onClick={() => answer(true)}>{ask?.yes}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
