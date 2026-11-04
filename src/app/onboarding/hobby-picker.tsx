'use client';

import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { PalettePicker } from '@/components/palette-picker';
import { Chip, Segmented } from '@/components/segmented';
import { Button } from '@/components/ui/button';
import { ageGroup, artistOptions } from '@/lib/artists';
import { CAT_ICON, GENRE_CAT, HOBBIES } from '@/lib/data';
import { pickGenres } from '@/lib/mn-songs';
import { applyPalette, DEFAULT_PALETTE, isPaletteId, type PaletteId } from '@/lib/palettes';
import { demoEntries } from '@/lib/seed';
import { createClient } from '@/lib/supabase/client';

const YEAR = new Date().getFullYear();
const validAge = (a: number) => a >= 10 && a <= 100;

/* Анх орж ирэхэд: 1) апп-ын өнгө сонгох → 2) нас, хобби, дууны төрөл, дуртай дуучин. Профайлаас засах үед зөвхөн 2-р алхам. */
export function HobbyPicker({ initial, initialTheme, initialBirthYear, initialArtists, editing, canSeed }: { initial: string[]; initialTheme: string; initialBirthYear: number | null; initialArtists: string[]; editing: boolean; canSeed: boolean }) {
  const router = useRouter();
  const first = !editing && !initial.length;
  const [step, setStep] = useState<'theme' | 'hobby'>(first ? 'theme' : 'hobby');
  const [theme, setPalette] = useState<PaletteId>(isPaletteId(initialTheme) ? initialTheme : DEFAULT_PALETTE);
  const [sel, setSel] = useState(() => new Set(initial));
  const [seed, setSeed] = useState(true);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [age, setAge] = useState(initialBirthYear ? String(YEAR - initialBirthYear) : '');
  const [artists, setArtists] = useState(initialArtists);
  const [custom, setCustom] = useState('');
  const { resolvedTheme, setTheme } = useTheme();
  // Сервер theme мэдэхгүй тул hydration дуустал гэрэлтэй гэж харуулна
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const ageNum = Number(age), birthYear = validAge(ageNum) ? YEAR - ageNum : null;
  const options = artistOptions(ageGroup(birthYear), pickGenres([...sel]));
  const toggleArtist = (a: string) => setArtists(l => (l.includes(a) ? l.filter(x => x !== a) : [...l, a].slice(0, 12)));
  const addCustom = () => { const a = custom.trim().slice(0, 60); if (a && !artists.includes(a)) setArtists(l => [...l, a].slice(0, 12)); setCustom(''); };

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
    const taste = { hobbies: [...sel], birth_year: birthYear, fav_artists: artists };
    const { error } = await supabase.from('profiles').update(first ? { ...taste, theme } : taste).eq('id', user.id);
    if (!error && first && canSeed && seed) await supabase.from('mood_entries').insert(demoEntries());
    // Амт өөрчлөгдвөл хадгалсан дууны саналыг устгаж шинээр үүсгүүлнэ
    const changed = pickGenres([...sel]).join() !== pickGenres(initial).join() || artists.join() !== initialArtists.join() || birthYear !== initialBirthYear;
    if (!error && changed) await supabase.from('song_recs').delete().eq('user_id', user.id).eq('kind', 'song');
    setBusy(false);
    if (error) return toast.error('Хадгалж чадсангүй: ' + error.message);
    if (editing) toast('Шинэчлэгдлээ');
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
      <PalettePicker value={theme} onChange={setPalette} />
      <h2 className="mt-5 mb-2 font-semibold">Горим</h2>
      <Segmented full label="Гэрэлтэй эсвэл харанхуй" value={mounted && resolvedTheme === 'dark' ? 'dark' : 'light'} onChange={setTheme} options={[['light', '☀️ Гэрэлтэй'], ['dark', '🌙 Харанхуй']]} />
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
      <h1 className="my-2 text-[28px] leading-9 font-bold">Таны тухай</h1>
      <div className="mb-5">
        <label htmlFor="age" className="mb-1.5 block font-semibold">Хэдэн настай вэ?</label>
        <p className="mb-2 text-sm text-muted-foreground">Тухайн насныхны ихэвчлэн сонсдог дууг санал болгоход хэрэглэнэ.</p>
        <input id="age" type="number" inputMode="numeric" min={10} max={100} value={age} onChange={e => setAge(e.target.value)} placeholder="Нас"
          className="h-12 w-32 rounded-xl border-[1.5px] bg-card px-3.5 focus:border-primary focus:outline-none" />
      </div>
      <h2 className="mb-1 text-[22px] leading-[30px] font-semibold">Таны сонирхол юу вэ?</h2>
      <p className="mb-4 text-muted-foreground">Хоббид тань тулгуурлан тохирох дасгал, дуу, ая, кино санал болгоно. Дор хаяж 1-ийг сонгоно уу.</p>
      <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="🔍 Хобби хайх (жишээ нь: гитар, йог)" aria-label="Хобби хайх"
        className="mb-5 h-12 w-full rounded-xl border-[1.5px] bg-card px-3.5 focus:border-primary focus:outline-none" />
      {cats.map(([cat, items]) => {
        const n = HOBBIES[cat].filter(h => sel.has(h)).length;
        return (
          <section key={cat} className="mb-5">
            <h3 className="mb-2 font-semibold">{CAT_ICON[cat]} {cat}{n > 0 && <span className="ml-1.5 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{n}</span>}</h3>
            {cat === GENRE_CAT && <p className="mb-2 text-sm text-muted-foreground">Сонгосон төрлөөр тань монгол болон олон улсын дуу санал болгоно.</p>}
            <div className="flex flex-wrap gap-2">{items.map(h => <Chip key={h} on={sel.has(h)} onClick={() => toggle(h)}>{h}</Chip>)}</div>
          </section>
        );
      })}
      {!cats.length && <p className="mb-5 text-sm text-muted-foreground">«{query}» олдсонгүй.</p>}
      <section className="mb-5">
        <h3 className="mb-1 font-semibold">🎤 Дуртай дуучин{artists.length > 0 && <span className="ml-1.5 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{artists.length}</span>}</h3>
        <p className="mb-2 text-sm text-muted-foreground">Эдгээрийн дууг YouTube-ээс хайж санал болгоно. Жагсаалт таны нас, төрлөөр өөрчлөгдөнө.</p>
        <div className="mb-1.5 text-sm font-semibold">Монгол</div>
        <div className="mb-3 flex flex-wrap gap-2">{options.mongolian.map(a => <Chip key={a} on={artists.includes(a)} onClick={() => toggleArtist(a)}>{a}</Chip>)}</div>
        <div className="mb-1.5 text-sm font-semibold">Олон улсын</div>
        <div className="mb-3 flex flex-wrap gap-2">{options.international.map(a => <Chip key={a} on={artists.includes(a)} onClick={() => toggleArtist(a)}>{a}</Chip>)}</div>
        <div className="flex gap-2">
          <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="Өөр дуучин нэмэх" aria-label="Дуучны нэр" maxLength={60}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
            className="h-12 min-w-0 flex-1 rounded-xl border-[1.5px] bg-card px-3.5 focus:border-primary focus:outline-none" />
          <Button type="button" size="xl" variant="secondary" className="h-12 flex-none" onClick={addCustom}>＋</Button>
        </div>
        {artists.some(a => !options.mongolian.includes(a) && !options.international.includes(a)) && (
          <div className="mt-2 flex flex-wrap gap-2">{artists.filter(a => !options.mongolian.includes(a) && !options.international.includes(a)).map(a => <Chip key={a} on onClick={() => toggleArtist(a)}>{a}</Chip>)}</div>
        )}
      </section>
      {first && canSeed && (
        <label className="mb-4 flex items-center gap-2.5 text-sm">
          <input type="checkbox" className="size-5 accent-primary" checked={seed} onChange={e => setSeed(e.target.checked)} />
          Туршилтын 5 долоо хоногийн өгөгдөл нэмэх
        </label>
      )}
      <div className="fixed inset-x-0 bottom-0 border-t bg-card px-4 pt-3 pb-[calc(12px+var(--safe-b))]">
        <Button size="xl" className="mx-auto flex w-full max-w-[760px]" disabled={!sel.size || busy || (first && !birthYear)} onClick={done}>
          {busy ? 'Хадгалж байна…' : first && !birthYear ? 'Насаа оруулна уу' : `Үргэлжлүүлэх (${sel.size} сонгосон)`}
        </Button>
      </div>
    </div>
  );
}
