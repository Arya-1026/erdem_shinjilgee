'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PalettePicker } from '@/components/palette-picker';
import { Chip } from '@/components/segmented';
import { Button } from '@/components/ui/button';
import { CAT_ICON, HOBBIES } from '@/lib/data';
import { applyPalette, DEFAULT_PALETTE, isPaletteId, type PaletteId } from '@/lib/palettes';
import { demoEntries } from '@/lib/seed';
import { createClient } from '@/lib/supabase/client';

/* Анх орж ирэхэд: 1) апп-ын өнгө сонгох → 2) хобби сонгох. Профайлаас засах үед зөвхөн хобби. */
export function HobbyPicker({ initial, initialTheme, editing, canSeed }: { initial: string[]; initialTheme: string; editing: boolean; canSeed: boolean }) {
  const router = useRouter();
  const first = !editing && !initial.length;
  const [step, setStep] = useState<'theme' | 'hobby'>(first ? 'theme' : 'hobby');
  const [theme, setTheme] = useState<PaletteId>(isPaletteId(initialTheme) ? initialTheme : DEFAULT_PALETTE);
  const [sel, setSel] = useState(() => new Set(initial));
  const [seed, setSeed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');

  // Сонгосон өнгө бүх дэлгэцэд шууд харагдана
  useEffect(() => { applyPalette(theme); }, [theme]);

  const toggle = (h: string) => setSel(s => { const n = new Set(s); if (n.has(h)) n.delete(h); else n.add(h); return n; });
  const q = query.trim().toLowerCase();
  const cats = Object.entries(HOBBIES)
    .map(([cat, items]) => [cat, q && !cat.toLowerCase().includes(q) ? items.filter(h => h.toLowerCase().includes(q)) : items] as const)
    .filter(([, items]) => items.length);

  async function done() {
    setBusy(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.replace('/login');
    const { error } = await supabase.from('profiles').update(first ? { hobbies: [...sel], theme } : { hobbies: [...sel] }).eq('id', user.id);
    if (!error && first && canSeed && seed) await supabase.from('mood_entries').insert(demoEntries());
    setBusy(false);
    if (error) return toast.error('Хадгалж чадсангүй: ' + error.message);
    if (editing) toast('Хобби шинэчлэгдлээ');
    router.replace(editing ? '/profile' : '/home');
    router.refresh();
  }

  if (step === 'theme') return (
    <div className="mx-auto max-w-[760px] px-4 pt-[calc(24px+env(safe-area-inset-top))] pb-32">
      <div className="grad-dawn mb-5 rounded-3xl p-5">
        <p className="text-sm font-semibold opacity-80">Алхам 1 / 2</p>
        <h1 className="my-1 text-[28px] leading-9 font-bold">Тавтай морил 🌙</h1>
        <p>Апп-аа өөрт таалагдах өнгөөр тохируулъя. Энэ өнгө товч, цэс, график дээр харагдана. Дараа нь Профайл хэсгээс сольж болно.</p>
      </div>
      <h2 className="mb-3 text-[22px] leading-[30px] font-semibold">Ямар өнгө танд таалагдаж байна?</h2>
      <PalettePicker value={theme} onChange={setTheme} />
      <div className="fixed inset-x-0 bottom-0 border-t bg-card px-4 pt-3 pb-[calc(12px+var(--safe-b))]">
        <Button size="xl" className="mx-auto flex w-full max-w-[760px]" onClick={() => { setStep('hobby'); scrollTo(0, 0); }}>Үргэлжлүүлэх</Button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-[760px] px-4 pt-[calc(24px+env(safe-area-inset-top))] pb-32">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{editing ? 'Профайл засах' : 'Алхам 2 / 2'}</p>
        {first && <button className="text-sm font-semibold text-primary" onClick={() => setStep('theme')}>← Өнгө</button>}
      </div>
      <h1 className="my-2 text-[28px] leading-9 font-bold">Таны сонирхол юу вэ?</h1>
      <p className="mb-4 text-muted-foreground">Хоббид тань тулгуурлан тохирох дасгал, дуу, ая, кино санал болгоно. Дор хаяж 1-ийг сонгоно уу.</p>
      <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="🔍 Хобби хайх (жишээ нь: гитар, йог)" aria-label="Хобби хайх"
        className="mb-5 h-12 w-full rounded-xl border-[1.5px] bg-card px-3.5 focus:border-primary focus:outline-none" />
      {cats.map(([cat, items]) => {
        const n = HOBBIES[cat].filter(h => sel.has(h)).length;
        return (
          <section key={cat} className="mb-5">
            <h3 className="mb-2 font-semibold">{CAT_ICON[cat]} {cat}{n > 0 && <span className="ml-1.5 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{n}</span>}</h3>
            <div className="flex flex-wrap gap-2">{items.map(h => <Chip key={h} on={sel.has(h)} onClick={() => toggle(h)}>{h}</Chip>)}</div>
          </section>
        );
      })}
      {!cats.length && <p className="mb-5 text-sm text-muted-foreground">«{query}» олдсонгүй.</p>}
      {first && canSeed && (
        <label className="mb-4 flex items-center gap-2.5 text-sm">
          <input type="checkbox" className="size-5 accent-primary" checked={seed} onChange={e => setSeed(e.target.checked)} />
          Туршилтын 5 долоо хоногийн өгөгдөл нэмэх
        </label>
      )}
      <div className="fixed inset-x-0 bottom-0 border-t bg-card px-4 pt-3 pb-[calc(12px+var(--safe-b))]">
        <Button size="xl" className="mx-auto flex w-full max-w-[760px]" disabled={!sel.size || busy} onClick={done}>
          {busy ? 'Хадгалж байна…' : `Үргэлжлүүлэх (${sel.size} сонгосон)`}
        </Button>
      </div>
    </div>
  );
}
