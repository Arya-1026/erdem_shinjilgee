/* 4-7-8 амьсгалын тайвшруулах ая (claude.ai «breath478» хувилбар). Файлгүй, хөтөч дотор Web Audio-гоор шууд үүсгэнэ,
   тиймээс цагирагтай секунд тутамд таарч, хоцрохгүй.
   - Аккорд амьсгал авахад чангарч, барихад тогтож, гаргахад намдана. Давталт бүрд солигдоно (D → Bm → G → A).
   - Далайн давалгаа шиг зөөлөн шуугиан амьсгалыг дагана, доор нь D нотны бага дуу (дрон) тасралтгүй.
   - Үе шат бүрийн эхэнд хонх: авах (өндөр), барих (дунд), гаргах (нам). Төгсгөлд гурван хонхоор дуусна. */

export const BREATH_LEAD = 2; // «Бэлдээрэй» секунд: аккорд, дрон аажмаар орж ирнэ
const CYCLE = 19, TAIL = 4;
const PHASE_SEC = [4, 7, 8];
const BELLS = [880.0, 739.99, 587.33];
const CHORDS = [
  [146.83, 220.0, 277.18, 329.63, 440.0], // Dmaj9
  [123.47, 185.0, 246.94, 293.66, 369.99], // Bm7
  [98.0, 196.0, 246.94, 293.66, 369.99], // Gmaj7
  [110.0, 164.81, 220.0, 277.18, 329.63], // A6/9
];

function bell(ctx: AudioContext, out: AudioNode, rev: AudioNode, f: number, t: number, peak: number) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);
  const dry = ctx.createGain(); dry.gain.value = 0.45;
  g.connect(dry).connect(out); g.connect(rev);
  for (const [m, a] of [[1, 1], [2.01, 0.28], [3.0, 0.1], [4.2, 0.05]]) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * m;
    const og = ctx.createGain(); og.gain.value = a;
    o.connect(og).connect(g); o.start(t); o.stop(t + 4.3);
  }
}

function schedule(ctx: AudioContext, out: AudioNode, t0: number, rounds: number) {
  const end = t0 + rounds * CYCLE;

  // Цуурай
  const rev = ctx.createConvolver();
  const len = Math.floor(ctx.sampleRate * 3.8);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  rev.buffer = ir;
  const revGain = ctx.createGain(); revGain.gain.value = 0.55;
  rev.connect(revGain).connect(out);

  // D нотны бага дрон
  const drone = ctx.createOscillator(); drone.type = 'sine'; drone.frequency.value = 73.42;
  const dg = ctx.createGain();
  dg.gain.setValueAtTime(0.0001, t0 - BREATH_LEAD);
  dg.gain.linearRampToValueAtTime(0.07, t0);
  dg.gain.setValueAtTime(0.07, end);
  dg.gain.linearRampToValueAtTime(0.0001, end + TAIL);
  drone.connect(dg).connect(out); dg.connect(rev);
  drone.start(t0 - BREATH_LEAD); drone.stop(end + TAIL + 0.1);

  // Амьсгалыг дагах далайн шуугиан (brown noise)
  const nb = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
  const nd = nb.getChannelData(0); let last = 0;
  for (let i = 0; i < nd.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; nd[i] = last * 3.2; }
  const noise = ctx.createBufferSource(); noise.buffer = nb; noise.loop = true;
  const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 700;
  const ng = ctx.createGain(); ng.gain.setValueAtTime(0.0001, t0 - BREATH_LEAD); ng.gain.linearRampToValueAtTime(0.04, t0);
  noise.connect(nf).connect(ng).connect(out);
  noise.start(t0 - BREATH_LEAD); noise.stop(end + TAIL + 0.1);

  for (let r = 0; r < rounds; r++) {
    const t = t0 + r * CYCLE;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.6;
    lp.frequency.setValueAtTime(320, t);
    lp.frequency.linearRampToValueAtTime(1900, t + 4);
    lp.frequency.linearRampToValueAtTime(1300, t + 11);
    lp.frequency.linearRampToValueAtTime(360, t + 19);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t - 0.8);
    g.gain.linearRampToValueAtTime(0.1, t);
    g.gain.linearRampToValueAtTime(0.34, t + 4);
    g.gain.linearRampToValueAtTime(0.27, t + 11);
    g.gain.linearRampToValueAtTime(0.0001, t + 19.6);
    lp.connect(g); g.connect(out); g.connect(rev);
    CHORDS[r % CHORDS.length].forEach((f, i) => {
      for (const [type, cents, amp] of [['sine', -5, 0.09], ['triangle', 6, 0.05]] as const) {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = cents + i;
        const og = ctx.createGain(); og.gain.value = amp;
        o.connect(og).connect(lp);
        o.start(t - 0.85); o.stop(t + 19.7);
      }
    });
    ng.gain.linearRampToValueAtTime(0.05, t);
    ng.gain.linearRampToValueAtTime(0.22, t + 4);
    ng.gain.linearRampToValueAtTime(0.07, t + 6);
    ng.gain.linearRampToValueAtTime(0.06, t + 11);
    ng.gain.linearRampToValueAtTime(0.2, t + 13);
    ng.gain.linearRampToValueAtTime(0.04, t + 19);
    nf.frequency.setValueAtTime(500, t);
    nf.frequency.linearRampToValueAtTime(1100, t + 4);
    nf.frequency.linearRampToValueAtTime(500, t + 11);
    nf.frequency.linearRampToValueAtTime(900, t + 13);
    nf.frequency.linearRampToValueAtTime(380, t + 19);
    let pt = t;
    PHASE_SEC.forEach((d, i) => { bell(ctx, out, rev, BELLS[i], pt, 0.16); pt += d; });
  }
  ng.gain.linearRampToValueAtTime(0.0001, end + TAIL);
  bell(ctx, out, rev, 587.33, end, 0.14);
  bell(ctx, out, rev, 880.0, end + 0.35, 0.1);
  bell(ctx, out, rev, 1174.66, end + 0.7, 0.08);
}

/** Аяыг эхлүүлнэ: эхний «Амьсгал ав» нь BREATH_LEAD секундын дараа. Хэрэглэгчийн товч дарах үйлдэл дотор дуудна. */
export function startBreathMusic(rounds: number, muted: boolean) {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  const master = ctx.createGain(); master.gain.value = muted ? 0 : 0.9;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
  master.connect(comp).connect(ctx.destination);
  schedule(ctx, master, ctx.currentTime + BREATH_LEAD, rounds);
  let closed = false;
  const close = (afterMs: number) => { if (closed) return; closed = true; setTimeout(() => void ctx.close(), afterMs); };
  return {
    setMuted: (m: boolean) => { if (!closed) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.2); },
    /** Дасгал дуусахад: сүүлийн хонхнууд дуугарч дуустал хүлээнэ */
    finish: () => close((TAIL + 0.5) * 1000),
    /** Дундуур нь зогсооход: хурдан намдаана */
    stop: () => { if (closed) return; master.gain.setTargetAtTime(0, ctx.currentTime, 0.25); close(1200); },
  };
}
