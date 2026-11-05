'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { MoodEmoji } from '@/components/mood-emoji';
import { useApp } from '@/components/providers/app-provider';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MOODS } from '@/lib/data';
import { NOTE_MAX, noteLive } from '@/lib/social';
import type { MoodId } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Бодол хуваалцах цонх: одоогийн сэтгэл санаа (хөдөлгөөнтэй эможи) + 60 тэмдэгт. Найзуудад 24 цаг харагдана. */
export function NoteEditor({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { profile, activeMood, updateProfile } = useApp();
  const live = noteLive(profile.note_at);
  const [text, setText] = useState(live ? profile.note_text ?? '' : '');
  const [mood, setMood] = useState<MoodId | null>(live ? profile.note_mood : activeMood.id);
  const [busy, setBusy] = useState(false);

  async function save(clear = false) {
    setBusy(true);
    const body = text.trim().replace(/\s+/g, ' ').slice(0, NOTE_MAX);
    await updateProfile(clear || (!body && !mood)
      ? { note_text: null, note_mood: null, note_at: null }
      : { note_text: body || null, note_mood: mood, note_at: new Date().toISOString() });
    setBusy(false);
    toast(clear ? 'Бодлоо устгалаа' : 'Бодлоо найзуудтайгаа хуваалцлаа 💭');
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>💭 Бодлоо хуваалцах</DialogTitle>
          <DialogDescription>Найзууд тань 24 цагийн турш таны аватарын дээр харна.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3">
          <div className="grid size-20 place-items-center rounded-full bg-secondary text-5xl" aria-live="polite">
            {mood ? <MoodEmoji key={mood} mood={mood} /> : <span className="text-2xl text-muted-foreground">…</span>}
          </div>
          <div className="flex flex-wrap justify-center gap-1.5" role="radiogroup" aria-label="Одоогийн сэтгэл санаа">
            {MOODS.map(m => (
              <button key={m.id} type="button" role="radio" aria-checked={mood === m.id} aria-label={m.label} title={m.label}
                onClick={() => setMood(mood === m.id ? null : m.id)}
                className={cn('grid size-10 place-items-center rounded-full text-2xl transition-transform', mood === m.id ? 'scale-110 bg-primary/15 ring-2 ring-primary' : 'hover:bg-secondary')}>
                {m.emoji}
              </button>
            ))}
          </div>
          <div className="w-full">
            <textarea value={text} onChange={e => setText(e.target.value.slice(0, NOTE_MAX))} rows={2} maxLength={NOTE_MAX} placeholder="Юу бодож байна?" aria-label="Бодол"
              className="w-full resize-none rounded-xl border-[1.5px] bg-card px-3.5 py-2.5 focus:border-primary focus:outline-none" />
            <p className="text-right text-xs text-muted-foreground">{text.length}/{NOTE_MAX}</p>
          </div>
          <Button size="xl" className="w-full" disabled={busy || (!text.trim() && !mood)} onClick={() => void save()}>Хуваалцах</Button>
          {live && <Button size="xl" variant="ghost" className="w-full text-destructive" disabled={busy} onClick={() => void save(true)}>Бодлоо устгах</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
