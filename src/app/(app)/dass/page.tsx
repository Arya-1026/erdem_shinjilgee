'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { useApp } from '@/components/providers/app-provider';
import { useT } from '@/components/providers/locale-provider';
import { ExerciseArt } from '@/components/exercise-art';
import { DassHelpCard } from '@/components/dass-help';
import { Button } from '@/components/ui/button';
import { RECS } from '@/lib/data';
import {
  DASS_CHOICES, DASS_COUNT, DASS_EXPLAIN, DASS_ITEMS, DASS_MAX, DASS_RECS, DASS_RETAKE_DAYS, DASS_SCALES, dassLevel, helpLevel, LEVEL_LABEL,
  levelBand, SCALE_DESC, SCALE_LABEL, scoreDass, type DassLevel, type DassScale, type DassScores,
} from '@/lib/dass';
import { snoozeDass } from '@/lib/dass-client';
import { cn } from '@/lib/utils';

type Result = DassScores & { id: string; answers: number[]; created_at: string };
const PENDING_ID = 'pending';
type Stage = 'loading' | 'intro' | 'quiz' | 'result';

const PROGRESS_KEY = 'setgel-dass-progress';
const LEVEL_COLOR: Record<DassLevel, string> = {
  normal: 'bg-emerald-500', mild: 'bg-lime-500', moderate: 'bg-amber-500', severe: 'bg-orange-600', extreme: 'bg-red-600',
};
const SCALE_ICON: Record<DassScale, string> = { depression: '🌧️', anxiety: '🌀', stress: '🔥' };
// 7, 14 дэх асуултын дараа Ботгоо урам өгнө
const CHEER: Record<number, string> = { 7: 'Гуравны нэгийг дуусгалаа 👍', 14: 'Бараг дууслаа, ганцхан хэсэг үлдлээ 💪' };

const isFirst = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('first');
const noop = () => () => {};

function loadProgress(): number[] {
  try {
    const p = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? 'null') as { a: number[]; at: number } | null;
    // 2 өдрөөс хуучин хагас хариулт «сүүлийн 7 хоног»-ийг илэрхийлэхээ больсон
    return p && Date.now() - p.at < 2 * 864e5 ? p.a.slice(0, DASS_COUNT) : [];
  } catch { return []; }
}
const saveProgress = (a: number[]) => { try { localStorage.setItem(PROGRESS_KEY, JSON.stringify({ a, at: Date.now() })); } catch { /* хувийн цонх */ } };
const clearProgress = () => { try { localStorage.removeItem(PROGRESS_KEY); } catch { /* хувийн цонх */ } };

export default function DassPage() {
  const tr = useT();
  const router = useRouter();
  const { supabase } = useApp();
  const first = useSyncExternalStore(noop, isFirst, () => false);
  const [stage, setStage] = useState<Stage>('loading');
  const [history, setHistory] = useState<Result[]>([]);
  const [answers, setAnswers] = useState<number[]>([]);
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  // Сүлжээ/сервер алдаагаар хадгалагдаагүй үр дүн: «Хадгалаад нүүр хуудас руу» товч дахин илгээнэ
  const [pending, setPending] = useState<number[] | null>(null);
  // Бүртгүүлсний дараах анхны асуулга: «Буцах» нь onboarding руу биш Нүүр рүү очно
  const [wasFirst, setWasFirst] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('dass_results').select('id,answers,depression,anxiety,stress,created_at').order('created_at', { ascending: false }).limit(12);
    if (error) toast.error(tr('Асуулгын хүснэгт олдсонгүй. supabase/migrations/0020_dass.sql-ийг ажиллуулна уу.'));
    const rows = (data ?? []) as Result[];
    setHistory(rows);
    setStage(rows.length && !isFirst() ? 'result' : 'intro');
  }, [supabase, tr]);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  function start() {
    setAnswers(loadProgress());
    setStage('quiz');
    window.scrollTo({ top: 0 });
  }
  function later() {
    snoozeDass();
    router.replace('/home');
  }

  /** Үр дүнг Supabase-д хадгална. Амжилттай бол true. */
  async function save(all: number[]) {
    setSaving(true);
    const s = scoreDass(all);
    const { data, error } = await supabase.from('dass_results').insert({ answers: all, ...s, research_consent: consent })
      .select('id,answers,depression,anxiety,stress,created_at').single();
    setSaving(false);
    if (error || !data) {
      toast.error(tr('Хадгалж чадсангүй: ') + (error?.message ?? ''));
      // Хариултыг алдахгүй: үр дүнг түр харуулж, хадгалах товчоор дахин оролдуулна
      setPending(all);
      setHistory(h => [{ id: PENDING_ID, answers: all, ...s, created_at: new Date().toISOString() }, ...h.filter(x => x.id !== PENDING_ID)]);
      return false;
    }
    clearProgress();
    setPending(null);
    setHistory(h => [data as Result, ...h.filter(x => x.id !== PENDING_ID)]);
    // ?first=1 үлдвэл дахин орж ирэхэд танилцуулга харагдаж, «хадгалагдаагүй» мэт санагддаг байсан
    if (isFirst()) { setWasFirst(true); router.replace('/dass', { scroll: false }); }
    toast(tr('✅ Үр дүн хадгалагдлаа'));
    return true;
  }

  async function answer(v: number) {
    const next = [...answers, v];
    if (next.length < DASS_COUNT) {
      setAnswers(next); saveProgress(next);
      if (CHEER[next.length]) toast(`🐫 ${tr(CHEER[next.length])}`);
      return;
    }
    await save(next);
    setAnswers([]);
    setStage('result');
    window.scrollTo({ top: 0 });
  }

  /** «Хадгалаад нүүр хуудас руу шилжих»: хадгалагдаагүй бол хадгалаад, Нүүр рүү очно */
  async function saveAndHome() {
    if (pending && !(await save(pending))) return;
    router.push('/home');
  }
  const back = () => { const a = answers.slice(0, -1); setAnswers(a); saveProgress(a); };

  if (stage === 'loading') return <p className="py-16 text-center text-muted-foreground">{tr('Ачаалж байна…')}</p>;
  if (stage === 'intro') return <Intro first={first} consent={consent} setConsent={setConsent} onStart={start} onLater={later} hasPrevious={history.length > 0} onBack={() => setStage('result')} />;
  if (stage === 'quiz') return <Quiz answers={answers} saving={saving} onAnswer={a => void answer(a)} onBack={back} onExit={() => setStage(history.length ? 'result' : 'intro')} />;
  return <ResultView history={history} saved={!pending} saving={saving} backHome={first || wasFirst} onSaveHome={() => void saveAndHome()} onRetake={() => setStage('intro')} />;
}

/* ---------- Танилцуулга: зөвшөөрөл асууна ---------- */
function Intro({ first, consent, setConsent, onStart, onLater, hasPrevious, onBack }: {
  first: boolean; consent: boolean; setConsent: (v: boolean) => void; onStart: () => void; onLater: () => void; hasPrevious: boolean; onBack: () => void;
}) {
  const tr = useT();
  const resume = loadProgress().length;
  return (
    <section className="card-x mx-auto max-w-[620px]">
      <div className="flex items-start gap-3">
        <span className="text-5xl" aria-hidden="true">🐫</span>
        <div>
          <h1 className="text-xl font-bold">{first ? tr('Танилцсандаа баяртай байна!') : tr('Сэтгэл зүйн асуулга (DASS-21)')}</h1>
          <p className="mt-1 text-muted-foreground">{tr('Сүүлийн 7 хоногт ямар байсныг чинь мэдвэл илүү тохирсон зөвлөгөө өгч чадна. 21 богино асуулт, 3 минут орчим.')}</p>
        </div>
      </div>
      <ul className="mt-4 grid gap-2 text-sm">
        <li>📊 {tr('Гутрал, түгшүүр, стресс гурвыг тус тусад нь харуулна.')}</li>
        <li>🔒 {tr('Хариулт тань зөвхөн танд харагдана. Найзуудад харагдахгүй.')}</li>
        <li>🩺 {tr('Энэ бол скрининг, эмчийн онош биш.')}</li>
      </ul>
      <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl bg-secondary p-3 text-sm">
        <input type="checkbox" className="mt-0.5 size-4 accent-[var(--primary)]" checked={consent} onChange={e => setConsent(e.target.checked)} />
        <span>{tr('Хариултыг минь нэр нь үл мэдэгдэх байдлаар эрдэм шинжилгээний судалгаанд ашиглахыг зөвшөөрч байна (заавал биш).')}</span>
      </label>
      <Button size="xl" className="mt-4 w-full" onClick={onStart}>{resume ? tr('▶ Үргэлжлүүлэх ({0}/21)', resume) : tr('▶ Эхлэх')}</Button>
      {hasPrevious ? <Button size="xl" variant="ghost" className="mt-2 w-full" onClick={onBack}>{tr('← Өмнөх үр дүн')}</Button>
        : <Button size="xl" variant="ghost" className="mt-2 w-full" onClick={onLater}>{tr('Дараа нь')}</Button>}
    </section>
  );
}

/* ---------- Асуулт: нэг дэлгэцэд нэг, дарахад шууд дараагийнх руу ---------- */
function Quiz({ answers, saving, onAnswer, onBack, onExit }: { answers: number[]; saving: boolean; onAnswer: (v: number) => void; onBack: () => void; onExit: () => void }) {
  const tr = useT();
  const i = Math.min(answers.length, DASS_COUNT - 1);
  return (
    <section className="card-x mx-auto max-w-[620px]">
      <div className="flex items-center justify-between text-sm font-semibold text-muted-foreground">
        <span>{tr('Асуулт {0} / {1}', i + 1, DASS_COUNT)}</span>
        <button type="button" className="hover:text-foreground" onClick={onExit}>{tr('Түр гарах')}</button>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label={tr('Асуулгын явц')} aria-valuemin={0} aria-valuemax={DASS_COUNT} aria-valuenow={answers.length}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${(answers.length / DASS_COUNT) * 100}%` }} />
      </div>
      <p className="mt-5 text-sm text-muted-foreground">{tr('Сүүлийн 7 хоногт…')}</p>
      <h2 key={i} className="fade-up mt-1 min-h-[3.5em] text-[1.2rem] leading-snug font-bold">{tr(DASS_ITEMS[i].mn)}</h2>
      <div className="mt-4 grid gap-2.5">
        {DASS_CHOICES.map((c, v) => (
          <button key={v} type="button" disabled={saving} onClick={() => onAnswer(v)}
            className="flex min-h-14 items-center gap-3 rounded-2xl border-[1.5px] bg-background px-4 text-left font-semibold transition-colors hover:border-primary hover:bg-secondary disabled:opacity-60">
            <span className="grid size-8 flex-none place-items-center rounded-full bg-secondary text-sm tabular-nums">{v}</span>{tr(c)}
          </button>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <button type="button" className="font-semibold text-primary disabled:opacity-40" disabled={!answers.length || saving} onClick={onBack}>{tr('← Өмнөх асуулт')}</button>
        <span className="text-muted-foreground">{tr('Зөв, буруу хариулт байхгүй')}</span>
      </div>
    </section>
  );
}

/* ---------- Хэмжүүр бүрийн тайлбар: юу гэсэн үг, анхаарахгүй бол ямар үр дагавартай ---------- */
function Explain({ scale, level }: { scale: DassScale; level: DassLevel }) {
  const tr = useT();
  const band = levelBand(level);
  const e = DASS_EXPLAIN[scale][band];
  return (
    <details className="group mt-2 rounded-xl bg-secondary/60 px-3 py-2 text-sm" open={band !== 'low'}>
      <summary className="cursor-pointer font-semibold text-primary marker:content-none">
        <span className="inline-block transition-transform group-open:rotate-90" aria-hidden="true">›</span> {tr('Тайлбар, үр дагавар')}
      </summary>
      <p className="mt-1.5 text-muted-foreground">{tr(SCALE_DESC[scale])}</p>
      <p className="mt-1.5"><b>{tr('Юу гэсэн үг вэ:')}</b> {tr(e.meaning)}</p>
      <p className="mt-1"><b>{band === 'low' ? tr('Зөвлөмж:') : tr('Анхаарахгүй бол:')}</b> {tr(e.risk)}</p>
    </details>
  );
}

/* ---------- Үр дүн ---------- */
function ResultView({ history, saved, saving, backHome, onSaveHome, onRetake }: {
  history: Result[]; saved: boolean; saving: boolean; backHome: boolean; onSaveHome: () => void; onRetake: () => void;
}) {
  const tr = useT();
  const router = useRouter();
  const { openDialog } = useApp();
  const r = history[0];
  const [now] = useState(() => Date.now());
  const days = Math.floor((now - new Date(r.created_at).getTime()) / 864e5);
  const help = helpLevel(r, r.answers);
  // Хамгийн өндөр түвшинтэй хэмжүүрийн дасгалуудыг санал болгоно
  const rank = (k: DassScale) => ['normal', 'mild', 'moderate', 'severe', 'extreme'].indexOf(dassLevel(k, r[k]));
  const focus = [...DASS_SCALES].sort((a, b) => rank(b) - rank(a))[0];
  const allNormal = DASS_SCALES.every(k => rank(k) === 0);
  const recs = [...new Set(allNormal ? ['e5', 'e3', 'e4'] : DASS_RECS[focus])].map(id => RECS.find(x => x.id === id)!).filter(Boolean);
  const date = (iso: string) => iso.slice(0, 10).slice(5).replace('-', '/');

  return (
    <div className="mx-auto grid max-w-[620px] gap-4">
      {/* Нүүр/Профайлаас орж ирсэн газар руугаа буцна (шууд нээсэн бол Нүүр) */}
      <button type="button" className="justify-self-start text-sm font-semibold text-primary"
        onClick={() => (window.history.length > 1 && !backHome ? router.back() : router.push('/home'))}>{tr('← Буцах')}</button>
      {/* Босго давсан бол хамгийн дээр: яаралтай холбогдох товчнууд */}
      {help === 'urgent' && <DassHelpCard level="urgent" scores={r} />}
      <section className="card-x">
        <h1 className="text-xl font-bold">{tr('Таны үр дүн')}</h1>
        <p className="text-sm text-muted-foreground">{days === 0 ? tr('Өнөөдөр бөглөсөн · сүүлийн 7 хоногийн байдал') : tr('{0} өдрийн өмнө бөглөсөн · тухайн үеийн 7 хоногийн байдал', days)}</p>
        <div className="mt-4 grid gap-4">
          {DASS_SCALES.map(k => {
            const lv = dassLevel(k, r[k]);
            return (
              <div key={k}>
                <div className="flex items-baseline justify-between gap-2">
                  <b>{SCALE_ICON[k]} {tr(SCALE_LABEL[k])}</b>
                  <span className="text-sm font-semibold">{tr(LEVEL_LABEL[lv])} <span className="text-muted-foreground tabular-nums">· {r[k]}/{DASS_MAX}</span></span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-secondary">
                  <div className={cn('h-full rounded-full', LEVEL_COLOR[lv])} style={{ width: `${Math.max(4, (r[k] / DASS_MAX) * 100)}%` }} />
                </div>
                <Explain scale={k} level={lv} />
              </div>
            );
          })}
        </div>
        <p className="mt-4 rounded-xl bg-secondary p-3 text-sm">⚠️ {tr('Энэ нь эмчийн онош биш, скрининг юм. Таны сэтгэл санааг ерөнхийд нь харуулах зорилготой.')}</p>
        <p className={cn('mt-3 text-sm font-semibold', saved ? 'text-ok' : 'text-destructive')} role="status">
          {saved ? tr('✅ Үр дүн таны профайлд хадгалагдсан') : tr('⚠️ Үр дүн хараахан хадгалагдаагүй байна')}
        </p>
        <Button size="xl" className="mt-3 w-full" disabled={saving} onClick={onSaveHome}>
          {saving ? tr('Хадгалж байна…') : tr('💾 Хадгалаад нүүр хуудас руу шилжих')}
        </Button>
      </section>

      {help === 'urgent' && (
        <section className="card-x">
          <h2 className="font-bold">🐫 {tr('Та ганцаараа биш')}</h2>
          <p className="mt-1 text-sm">{tr('Сүүлийн үед танд нэлээд хэцүү байсан бололтой. Үүнийг хуваалцсанд баярлалаа. Мэргэжлийн хүнтэй ярилцах нь үнэхээр тусалдаг. Танд тохирох тусламж бий.')}</p>
        </section>
      )}
      {help === 'suggest' && <DassHelpCard level="suggest" scores={r} />}

      <section className="card-x">
        <h2 className="font-bold">{allNormal ? tr('✨ Сайн байдлаа хадгалах дасгалууд') : tr('💡 Танд тохирох дасгалууд')}</h2>
        <div className="mt-3 grid gap-2">
          {recs.map(x => (
            <button key={x.id} type="button" onClick={() => openDialog(x.action === 'breath' ? { kind: 'breath' } : { kind: 'exercise', recId: x.id })}
              className="flex items-center gap-3 rounded-2xl border bg-background p-2.5 text-left hover:bg-secondary">
              <ExerciseArt id={x.id} className="size-12 flex-none rounded-xl" />
              <span className="min-w-0"><b className="block">{tr(x.title)}</b><span className="block truncate text-xs text-muted-foreground">{tr(x.sub)}</span></span>
            </button>
          ))}
        </div>
      </section>

      <section className="card-x">
        <h2 className="font-bold">{tr('📅 Дараагийн удаа')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{days >= DASS_RETAKE_DAYS ? tr('2 долоо хоног өнгөрсөн байна. Дахин бөглөөд өөрчлөлтөө хараарай.') : tr('{0} хоногийн дараа дахин бөглөхийг санал болгоно. Ингэвэл өөрчлөлтөө харах боломжтой.', DASS_RETAKE_DAYS - days)}</p>
        {history.length > 1 && (
          <table className="mt-3 w-full text-sm tabular-nums">
            <thead><tr className="text-left text-muted-foreground"><th className="font-medium">{tr('Огноо')}</th>{DASS_SCALES.map(k => <th key={k} className="font-medium">{tr(SCALE_LABEL[k])}</th>)}</tr></thead>
            <tbody>{history.map(h => <tr key={h.id}><td>{date(h.created_at)}</td>{DASS_SCALES.map(k => <td key={k}>{h[k]} <span className="text-xs text-muted-foreground">{tr(LEVEL_LABEL[dassLevel(k, h[k])])}</span></td>)}</tr>)}</tbody>
          </table>
        )}
        <Button size="xl" variant={days >= DASS_RETAKE_DAYS ? 'default' : 'secondary'} className="mt-3 w-full" onClick={onRetake}>{tr('↻ Дахин бөглөх')}</Button>
      </section>
    </div>
  );
}
