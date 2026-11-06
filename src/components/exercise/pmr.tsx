'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/providers/locale-provider';
import { createNatureMusic, type NatureMusic } from '@/lib/nature-music';
import { PMR_SVG } from '@/lib/pmr-svg';
import { cn } from '@/lib/utils';

/* Булчин суллах дасгал (PMR, claude.ai «pmr_player»): 5 алхам × 48 сек = 4 мин.
   Алхам бүрд 2 удаа 7 сек чангалж, 17 сек сулална. Зураг дээр тухайн биеийн хэсэг тодорч,
   далайн давалгааны ая чангалах/суллахыг дагана. Цаг нь аяны цагаар явдаг тул хэзээ ч зөрөхгүй. */
const STEPS = [
  { text: 'Хөлийн булчингаа чангал', part: 'feet', at: [170, 139], r: 13 },
  { text: 'Гэдэсний булчингаа чангал', part: 'belly', at: [104, 136], r: 18 },
  { text: 'Гар, нударгаа чангал', part: 'arm', at: [88, 146], r: 12 },
  { text: 'Мөрөө чихэндээ ойртуул', part: 'shoulders', at: [60, 134], r: 15 },
  { text: 'Нүдээ аньж, нүүрээ чангал', part: 'face', at: [39, 131], r: 15 },
] as const;
const PHASES = [['tense', 7], ['release', 17], ['tense', 7], ['release', 17]] as const;
const STEP_SEC = 48, TOTAL = STEPS.length * STEP_SEC, LEAD = 3;
const SOUND_KEY = 'setgel-pmr-sound';

// Зураг дасгалыг дагана (өөрийн давталтаар биш): хуруу нугарах, нударга атгах, чангалах/суллах цагираг
const CSS = `
.pmr-art svg{width:100%;height:100%;display:block}
.pmr-art.paused *{animation-play-state:paused!important}
.pmr-art .pmr-toes,.pmr-art .pmr-hand{animation:none!important;transition:transform .7s ease}
.pmr-art .pmr-scan{display:none}
.pmr-art.t-feet .pmr-toes{transform:rotate(-16deg)}
.pmr-art.t-arm .pmr-hand{transform:scale(.75)}
.pmr-art #pmr-focus{opacity:0;transition:opacity .6s}
.pmr-art.tensing #pmr-focus,.pmr-art.releasing #pmr-focus{opacity:1}
.pmr-art #pmr-fr,.pmr-art #pmr-fx{transform-box:fill-box;transform-origin:center}
.pmr-art.tensing #pmr-fr{stroke:#ff8a5c;animation:pmr-tight .55s ease-in-out infinite alternate}
.pmr-art.tensing #pmr-fx{fill:url(#pmr-focusT)}
.pmr-art.releasing #pmr-fr{stroke:#fff;animation:pmr-loosen 2.6s ease-out infinite}
.pmr-art.releasing #pmr-fx{fill:url(#pmr-focusR);animation:pmr-swell 5s ease-in-out infinite}
@keyframes pmr-tight{from{transform:scale(1)}to{transform:scale(.82)}}
@keyframes pmr-loosen{0%{transform:scale(.8);opacity:.9}100%{transform:scale(1.9);opacity:0}}
@keyframes pmr-swell{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
@media (prefers-reduced-motion:reduce){.pmr-art *{animation:none!important}}`;

function at(e: number) {
  const step = Math.min(STEPS.length - 1, Math.floor(e / STEP_SEC));
  let t = e - step * STEP_SEC, i = 0;
  while (i < PHASES.length - 1 && t >= PHASES[i][1]) { t -= PHASES[i][1]; i++; }
  return { step, i, kind: PHASES[i][0], left: PHASES[i][1] - t, start: e - t };
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

type View = { e: number; status: 'ready' | 'run' | 'pause' | 'done' };

export function PmrCoach({ onFinish }: { onFinish: () => void }) {
  const tr = useT();
  const art = useRef<HTMLDivElement>(null);
  const music = useRef<NatureMusic | null>(null);
  const origin = useRef(0);
  const lastKey = useRef('');
  // Web Audio байхгүй үед (маш хуучин хөтөч) энгийн цагаар явна
  const fallback = useRef<{ base: number; paused: number | null } | null>(null);
  const [view, setView] = useState<View>({ e: -LEAD, status: 'ready' });
  const [sound, setSound] = useState(() => { try { return localStorage.getItem(SOUND_KEY) !== 'off'; } catch { return true; } });

  const now = () => {
    if (music.current) return music.current.now();
    const f = fallback.current;
    return f ? ((f.paused ?? performance.now()) - f.base) / 1000 : 0;
  };

  useEffect(() => () => { music.current?.stop(); }, []);

  // Зураг, ая хоёрыг үе шат солигдох бүрд тааруулна (DOM-ыг шууд өөрчилнө: SVG нь React-аас гадуур)
  useEffect(() => {
    if (view.status !== 'run') return;
    let raf = 0;
    const loop = () => {
      const e = now() - origin.current;
      if (e >= TOTAL) { setView({ e: TOTAL, status: 'done' }); return; }
      if (e >= 0) {
        const p = at(e), s = STEPS[p.step], key = `${p.step}:${p.i}`;
        if (key !== lastKey.current) {
          const t0 = origin.current + p.start;
          if (p.i === 0 && p.step > 0) music.current?.step(t0);
          if (p.kind === 'tense') music.current?.tense(t0, PHASES[p.i][1]); else music.current?.release(t0);
          const box = art.current;
          if (box) {
            box.className = cn('pmr-art size-full', p.kind === 'tense' ? `t-${s.part} tensing` : 'releasing');
            for (const id of ['pmr-fx', 'pmr-fr']) {
              const c = box.querySelector(`#${id}`);
              c?.setAttribute('cx', String(s.at[0])); c?.setAttribute('cy', String(s.at[1])); c?.setAttribute('r', String(s.r));
            }
          }
          lastKey.current = key;
        }
      }
      setView(v => (Math.floor(v.e * 4) === Math.floor(e * 4) ? v : { ...v, e }));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [view.status]);

  // Дуусахад: сүүлийн хонх, давалгаа сонсогдсоны дараа аяыг унтраана
  useEffect(() => {
    if (view.status !== 'done') return;
    const m = music.current; music.current = null;
    const id = setTimeout(() => m?.stop(), 6000);
    if (art.current) art.current.className = 'pmr-art size-full paused';
    return () => { clearTimeout(id); m?.stop(); };
  }, [view.status]);

  function play() {
    // Товч дарсан мөчид эхлүүлнэ: хөтөч дууг зөвхөн хэрэглэгчийн үйлдлээр зөвшөөрдөг
    if (view.status === 'ready') {
      music.current = createNatureMusic({ preset: 'waves', volume: sound ? 0.9 : 0, seed: 7 });
      if (music.current) music.current.start();
      else fallback.current = { base: performance.now(), paused: null };
      origin.current = now() + LEAD;
      lastKey.current = '';
    } else {
      music.current?.resume();
      const f = fallback.current;
      if (f && f.paused != null) { f.base += performance.now() - f.paused; f.paused = null; }
    }
    art.current?.classList.remove('paused');
    setView(v => ({ ...v, status: 'run' }));
  }
  function pause() {
    music.current?.pause();
    if (fallback.current) fallback.current.paused = performance.now();
    art.current?.classList.add('paused');
    setView(v => ({ ...v, status: 'pause' }));
  }
  function toggleSound() {
    const on = !sound;
    setSound(on);
    try { localStorage.setItem(SOUND_KEY, on ? 'on' : 'off'); } catch { /* хувийн цонх */ }
    music.current?.setVolume(on ? 0.9 : 0);
  }

  const { e, status } = view;
  const done = status === 'done', started = status !== 'ready';
  const p = e >= 0 && !done ? at(e) : null;
  const tense = p?.kind === 'tense';
  const left = Math.max(0, Math.ceil(TOTAL - Math.max(0, e)));

  return (
    <div className="mt-3 min-w-0">
      <style>{CSS}</style>
      <div className="relative grid place-items-center rounded-[18px] bg-secondary py-3">
        <div ref={art} className="pmr-art paused size-[min(320px,72vw)] overflow-hidden rounded-[26px]" dangerouslySetInnerHTML={{ __html: PMR_SVG }} />
        {(started && !done) || done ? (
          <span className={cn('absolute top-5 left-1/2 -translate-x-1/2 rounded-full bg-background/85 px-4 py-1.5 text-base font-extrabold whitespace-nowrap tabular-nums',
            done || !tense ? 'text-emerald-600 dark:text-emerald-300' : 'text-orange-600 dark:text-orange-300')} aria-live="polite">
            {done ? tr('Сайн байна! Бие чинь тайвширлаа 🌿')
              : !p ? tr('Бэлдээрэй… {0}', Math.ceil(-e))
              : tense ? tr('Чангал · {0}', Math.ceil(p.left)) : tr('Сулла, амьсгалаа гарга · {0}', Math.ceil(p.left))}
          </span>
        ) : null}
      </div>

      <p className="mt-3 text-sm text-muted-foreground">
        {done ? tr('Хэсэг хугацаанд нүдээ аниад тайван амьсгалаарай.') : p ? tr(STEPS[p.step].text) : tr('Зургийг дагаад хамт хийгээрэй. Нийт 4 мин.')}
      </p>
      <ol className="mt-2 text-sm">
        {STEPS.map((s, k) => {
          const st = done || (p && k < p.step) ? 'done' : p && k === p.step ? 'now' : '';
          return (
            <li key={s.part} className={cn('flex items-center gap-2 rounded-lg px-2.5 py-1.5 font-semibold transition-colors',
              st === 'now' && 'bg-primary/15', st === 'done' && 'text-muted-foreground')}>
              <span className="w-4 text-center">{st === 'done' ? '✓' : k + 1}</span>{tr(s.text)}
            </li>
          );
        })}
      </ol>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label={tr('Дасгалын явц')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((Math.max(0, e) / TOTAL) * 100)}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${(Math.max(0, e) / TOTAL) * 100}%` }} />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-sm text-muted-foreground">
        <span className="tabular-nums">{started ? tr('{0} үлдсэн', mmss(left)) : mmss(TOTAL)}</span>
        {!done && (
          <button type="button" onClick={toggleSound} aria-pressed={sound} className="flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold hover:bg-secondary">
            <span aria-hidden="true">{sound ? '🌊' : '🔕'}</span>{sound ? tr('Далайн ая асаалттай') : tr('Далайн ая унтраалттай')}
          </button>
        )}
      </div>

      {done ? <Button size="xl" className="mt-3 w-full" onClick={onFinish}>{tr('✓ Дууслаа')}</Button>
        : <Button size="xl" className="mt-3 w-full" onClick={status === 'run' ? pause : play}>
            {status === 'run' ? tr('⏸ Түр зогсоох') : status === 'pause' ? tr('▶ Үргэлжлүүлэх') : tr('▶ Дагаж эхлэх')}
          </Button>}
    </div>
  );
}
