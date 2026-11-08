'use client';

import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { PalettePicker } from '@/components/palette-picker';
import { Chip, Segmented } from '@/components/segmented';
import { Button } from '@/components/ui/button';
import { ageGroup, artistOptions } from '@/lib/artists';
import { canAddHobby, cleanHobby, pickHobbyCats } from '@/lib/custom-hobbies';
import { CAT_ICON, GENRE_CAT, HOBBIES } from '@/lib/data';
import { pickGenres } from '@/lib/mn-songs';
import { tasteGenres } from '@/lib/music-taste';
import { applyPalette, DEFAULT_PALETTE, isPaletteId, type PaletteId } from '@/lib/palettes';
import { createClient } from '@/lib/supabase/client';
import { useLocale, useT } from '@/components/providers/locale-provider';

const YEAR = new Date().getFullYear();
const validAge = (a: number) => a >= 10 && a <= 100;

/* Анх орж ирэхэд: 1) апп-ын өнгө сонгох → 2) нас, хобби, дууны төрөл, дуртай дуучин. Профайлаас засах үед зөвхөн 2-р алхам. */
export function HobbyPicker({ initial, initialCats = {}, initialTheme, initialBirthYear, initialArtists, editing }: { initial: string[]; initialCats?: Record<string, string>; initialTheme: string; initialBirthYear: number | null; initialArtists: string[]; editing: boolean }) {
  const tr = useT();
  const { locale } = useLocale();
  const router = useRouter();
  const first = !editing && !initial.length;
  const [step, setStep] = useState<'theme' | 'hobby'>(first ? 'theme' : 'hobby');
  const [theme, setPalette] = useState<PaletteId>(isPaletteId(initialTheme) ? initialTheme : DEFAULT_PALETTE);
  const [sel, setSel] = useState(() => new Set(initial));
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [age, setAge] = useState(initialBirthYear ? String(YEAR - initialBirthYear) : '');
  const [artists, setArtists] = useState(initialArtists);
  const [custom, setCustom] = useState('');
  const [hobbyCats, setHobbyCats] = useState(initialCats);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [catDraft, setCatDraft] = useState('');
  const { resolvedTheme, setTheme } = useTheme();
  // Сервер theme мэдэхгүй тул hydration дуустал гэрэлтэй гэж харуулна
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const ageNum = Number(age), birthYear = validAge(ageNum) ? YEAR - ageNum : null;
  const options = artistOptions(ageGroup(birthYear), pickGenres([...sel]));
  const toggleArtist = (a: string) => setArtists(l => (l.includes(a) ? l.filter(x => x !== a) : [...l, a].slice(0, 12)));
  const addCustom = () => { const a = custom.trim().slice(0, 60); if (a && !artists.includes(a)) setArtists(l => [...l, a].slice(0, 12)); setCustom(''); };

  // Сонгосон өнгө бүх дэлгэцэд шууд харагдана
  useEffect(() => { applyPalette(theme); }, [theme]);

  // Өөрөө нэмсэн хоббиг (✕) хасвал ангиллаас нь ч хасна
  const toggle = (h: string) => {
    setSel(s => { const n = new Set(s); if (n.has(h)) n.delete(h); else n.add(h); return n; });
    if (hobbyCats[h]) setHobbyCats(c => Object.fromEntries(Object.entries(c).filter(([k]) => k !== h)));
  };
  const q = query.trim().toLowerCase();
  // Монгол болон сонгосон хэлээрх нэрээр хоёуланд нь хайна
  const match = (s: string) => s.toLowerCase().includes(q) || tr(s).toLowerCase().includes(q);
  // Жагсаалтад байхгүй, хэрэглэгч өөрөө нэмсэн хоббиуд. Ангилал сонгож нэмсэн нь тухайн ангилалдаа харагдана.
  const known = new Set(Object.values(HOBBIES).flat().flatMap(h => [h.toLowerCase(), tr(h).toLowerCase()]));
  const customs = [...sel].filter(h => !known.has(h.toLowerCase()));
  const mine = customs.filter(h => !hobbyCats[h]);
  const inCat = (cat: string) => customs.filter(h => hobbyCats[h] === cat);
  const cats = Object.entries(HOBBIES)
    .map(([cat, items]) => [cat, q && !match(cat) ? items.filter(match) : items, q && !match(cat) ? inCat(cat).filter(match) : inCat(cat)] as const)
    .filter(([, items, own]) => items.length || own.length);
  const newHobby = cleanHobby(query);
  const canAdd = canAddHobby(newHobby, known, sel);
  const addHobby = () => { if (!canAdd) return; setSel(s => new Set(s).add(newHobby)); setQuery(''); };
  const catName = cleanHobby(catDraft);
  const canAddToCat = canAddHobby(catName, known, sel);
  const addToCat = () => {
    if (!addingTo || !canAddToCat) return;
    setSel(s => new Set(s).add(catName));
    setHobbyCats(c => ({ ...c, [catName]: addingTo }));
    setCatDraft('');
  };
  const openAdd = (cat: string) => { setAddingTo(a => (a === cat ? null : cat)); setCatDraft(''); };

  async function done() {
    setBusy(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.replace('/login');
    const taste = { hobbies: [...sel], birth_year: birthYear, fav_artists: artists, language: locale };
    const { error } = await supabase.from('profiles').update(first ? { ...taste, theme } : taste).eq('id', user.id);
    // Ангиллыг тусад нь хадгална: 0025 migration ороогүй DB дээр хобби хадгалахад саад болохгүй
    if (!error) await supabase.from('profiles').update({ hobby_cats: pickHobbyCats(hobbyCats, sel, Object.keys(HOBBIES)) }).eq('id', user.id);
    // Амт өөрчлөгдвөл хадгалсан дууны саналыг устгаж шинээр үүсгүүлнэ
    const genreKey = (hobbies: string[]) => tasteGenres(hobbies).map(t => t.genre).join();
    const changed = genreKey([...sel]) !== genreKey(initial) || artists.join() !== initialArtists.join() || birthYear !== initialBirthYear;
    if (!error && changed) await supabase.from('song_recs').delete().eq('user_id', user.id).eq('kind', 'song');
    setBusy(false);
    if (error) return toast.error(tr('Хадгалж чадсангүй: ') + error.message);
    if (editing) toast(tr('Шинэчлэгдлээ'));
    // Анх бүртгүүлсний дараа DASS-21 асуулга бөглөх эсэхийг асууна (заавал биш)
    router.replace(editing ? '/profile' : '/dass?first=1');
    router.refresh();
  }

  // Дуусаагүй бүртгэлийн session үлдсэн бол нэвтрэх хуудас руу буцах зам
  async function switchAccount() {
    await createClient().auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  if (step === 'theme') return (
    <div className="mx-auto max-w-[760px] px-4 pt-[calc(24px+env(safe-area-inset-top))] pb-32">
      <div className="grad-dawn mb-5 rounded-3xl p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold opacity-80">{tr('Алхам 1 / 2')}</p>
          <button type="button" className="min-h-9 text-sm font-semibold underline" onClick={() => void switchAccount()}>{tr('← Нэвтрэх хуудас руу')}</button>
        </div>
        <h1 className="my-1 text-[28px] leading-9 font-bold">{tr('Тавтай морил 🌙')}</h1>
        <p>{tr('Апп-аа өөрт таалагдах өнгөөр тохируулъя. Энэ өнгө товч, цэс, график дээр харагдана. Дараа нь Профайл хэсгээс сольж болно.')}</p>
      </div>
      <h2 className="mb-3 text-[22px] leading-[30px] font-semibold">{tr('Ямар өнгө танд таалагдаж байна?')}</h2>
      <PalettePicker value={theme} onChange={setPalette} />
      <h2 className="mt-5 mb-2 font-semibold">{tr('Горим')}</h2>
      <Segmented full label={tr('Гэрэлтэй эсвэл харанхуй')} value={mounted && resolvedTheme === 'dark' ? 'dark' : 'light'} onChange={setTheme} options={[['light', tr('☀️ Гэрэлтэй')], ['dark', tr('🌙 Харанхуй')]]} />
      <div className="fixed inset-x-0 bottom-0 border-t bg-card px-4 pt-3 pb-[calc(12px+var(--safe-b))]">
        <Button size="xl" className="mx-auto flex w-full max-w-[760px]" onClick={() => { setStep('hobby'); scrollTo(0, 0); }}>{tr('Үргэлжлүүлэх')}</Button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-[760px] px-4 pt-[calc(24px+env(safe-area-inset-top))] pb-32">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{editing ? tr('Профайл засах') : tr('Алхам 2 / 2')}</p>
        {first && <button className="text-sm font-semibold text-primary" onClick={() => setStep('theme')}>{tr('← Өнгө')}</button>}
      </div>
      <h1 className="my-2 text-[28px] leading-9 font-bold">{tr('Таны тухай')}</h1>
      <div className="mb-5">
        <label htmlFor="age" className="mb-1.5 block font-semibold">{tr('Хэдэн настай вэ?')}</label>
        <p className="mb-2 text-sm text-muted-foreground">{tr('Тухайн насныхны ихэвчлэн сонсдог дууг санал болгоход хэрэглэнэ.')}</p>
        <input id="age" type="number" inputMode="numeric" min={10} max={100} value={age} onChange={e => setAge(e.target.value)} placeholder={tr('Нас')}
          className="h-12 w-32 rounded-xl border-[1.5px] bg-card px-3.5 focus:border-primary focus:outline-none" />
      </div>
      <h2 className="mb-1 text-[22px] leading-[30px] font-semibold">{tr('Таны сонирхол юу вэ?')}</h2>
      <p className="mb-4 text-muted-foreground">{tr('Хоббид тань тулгуурлан тохирох дасгал, дуу, ая, кино санал болгоно. Дор хаяж 1-ийг сонгоно уу.')}</p>
      <div className="mb-5 flex gap-2">
        <input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={tr('🔍 Хайх эсвэл өөрийн хобби бичих')} aria-label={tr('Хобби хайх эсвэл нэмэх')} maxLength={40}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addHobby(); } }}
          className="h-12 min-w-0 flex-1 rounded-xl border-[1.5px] bg-card px-3.5 focus:border-primary focus:outline-none" />
        <Button type="button" size="xl" variant="secondary" className="h-12 flex-none" disabled={!canAdd} onClick={addHobby} aria-label={tr('Хобби нэмэх')} title={tr('Жагсаалтад байхгүй хоббиг нэмэх')}>＋</Button>
      </div>
      {canAdd && !cats.length && (
        <button type="button" onClick={addHobby} className="mb-5 flex min-h-12 w-full items-center gap-2 rounded-xl border-[1.5px] border-dashed border-primary px-3.5 text-left font-semibold text-primary">
          {tr('＋ Жагсаалтад алга. «{0}» хобби нэмэх', newHobby)}
        </button>
      )}
      {mine.length > 0 && (
        <section className="mb-5">
          <h3 className="mb-2 font-semibold">{tr('✨ Өөрийн нэмсэн')}<span className="ml-1.5 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{mine.length}</span></h3>
          <div className="flex flex-wrap gap-2">{mine.map(h => <Chip key={h} on onClick={() => toggle(h)}>{tr(h)} ✕</Chip>)}</div>
        </section>
      )}
      {cats.map(([cat, items, own]) => {
        const n = HOBBIES[cat].filter(h => sel.has(h)).length + inCat(cat).length;
        const adding = addingTo === cat;
        return (
          <section key={cat} className="mb-5">
            <h3 className="mb-2 font-semibold">{CAT_ICON[cat]} {tr(cat)}{n > 0 && <span className="ml-1.5 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{n}</span>}</h3>
            {cat === GENRE_CAT && <p className="mb-2 text-sm text-muted-foreground">{tr('Сонгосон төрлөөр тань монгол болон олон улсын дуу санал болгоно.')}</p>}
            <div className="flex flex-wrap gap-2">
              {items.map(h => <Chip key={h} on={sel.has(h)} onClick={() => toggle(h)}>{tr(h)}</Chip>)}
              {own.map(h => <Chip key={h} on onClick={() => toggle(h)} aria-label={tr('«{0}»-г хасах', h)}>{h} ✕</Chip>)}
              <Chip aria-expanded={adding} onClick={() => openAdd(cat)} className="border-dashed text-primary">{adding ? tr('✕ Болих') : tr('＋ Өөрийнхөө нэмэх')}</Chip>
            </div>
            {adding && (
              <div className="mt-2 flex gap-2">
                <input autoFocus value={catDraft} onChange={e => setCatDraft(e.target.value)} maxLength={40}
                  placeholder={tr('«{0}» ангилалд хобби бичих', tr(cat))} aria-label={tr('«{0}» ангилалд нэмэх хобби', tr(cat))}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addToCat(); } if (e.key === 'Escape') setAddingTo(null); }}
                  className="h-11 min-w-0 flex-1 rounded-xl border-[1.5px] bg-card px-3.5 focus:border-primary focus:outline-none" />
                <Button type="button" size="xl" className="h-11 flex-none px-4" disabled={!canAddToCat} onClick={addToCat}>{tr('Нэмэх')}</Button>
              </div>
            )}
            {adding && catName.length > 1 && !canAddToCat && <p className="mt-1.5 text-sm text-muted-foreground">{tr('Энэ хобби жагсаалтад аль хэдийн байна.')}</p>}
          </section>
        );
      })}
      {!cats.length && !canAdd && <p className="mb-5 text-sm text-muted-foreground">{tr('«{0}» олдсонгүй.', query)}</p>}
      <section className="mb-5">
        <h3 className="mb-1 font-semibold">{tr('🎤 Дуртай дуучин')}{artists.length > 0 && <span className="ml-1.5 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{artists.length}</span>}</h3>
        <p className="mb-2 text-sm text-muted-foreground">{tr('Эдгээрийн дууг Spotify-аас хайж санал болгоно. Жагсаалт таны нас, төрлөөр өөрчлөгдөнө.')}</p>
        <div className="mb-1.5 text-sm font-semibold">{tr('Монгол')}</div>
        <div className="mb-3 flex flex-wrap gap-2">{options.mongolian.map(a => <Chip key={a} on={artists.includes(a)} onClick={() => toggleArtist(a)}>{a}</Chip>)}</div>
        <div className="mb-1.5 text-sm font-semibold">{tr('Олон улсын')}</div>
        <div className="mb-3 flex flex-wrap gap-2">{options.international.map(a => <Chip key={a} on={artists.includes(a)} onClick={() => toggleArtist(a)}>{a}</Chip>)}</div>
        <div className="flex gap-2">
          <input value={custom} onChange={e => setCustom(e.target.value)} placeholder={tr('Өөр дуучин нэмэх')} aria-label={tr('Дуучны нэр')} maxLength={60}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
            className="h-12 min-w-0 flex-1 rounded-xl border-[1.5px] bg-card px-3.5 focus:border-primary focus:outline-none" />
          <Button type="button" size="xl" variant="secondary" className="h-12 flex-none" onClick={addCustom}>＋</Button>
        </div>
        {artists.some(a => !options.mongolian.includes(a) && !options.international.includes(a)) && (
          <div className="mt-2 flex flex-wrap gap-2">{artists.filter(a => !options.mongolian.includes(a) && !options.international.includes(a)).map(a => <Chip key={a} on onClick={() => toggleArtist(a)}>{a}</Chip>)}</div>
        )}
      </section>
      <div className="fixed inset-x-0 bottom-0 border-t bg-card px-4 pt-3 pb-[calc(12px+var(--safe-b))]">
        <Button size="xl" className="mx-auto flex w-full max-w-[760px]" disabled={!sel.size || busy || (first && !birthYear)} onClick={done}>
          {busy ? tr('Хадгалж байна…') : first && !birthYear ? tr('Насаа оруулна уу') : tr('Үргэлжлүүлэх ({0} сонгосон)', sel.size)}
        </Button>
      </div>
    </div>
  );
}
