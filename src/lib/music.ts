/* =========================================================
   ДЕМО ТОГЛУУЛАГЧ: дууны оронд Web Audio API-аар тухайн mood-ийн аялгууг үүсгэнэ.
   БОДИТ СИСТЕМ: start/stop-ийг Spotify Web Playback SDK-ийн
   player.play()/pause()-аар солино (хэрэглэгч Spotify Premium байх шаардлагатай).
   Зөвхөн браузерт (хэрэглэгчийн үйлдлээр) дуудна.
   ========================================================= */
type Profile = { bpm: number; root: number; scale: number[]; prog: number[][]; wave: OscillatorType; dens: number; kick?: boolean };

const PROF: Record<string, Profile> = {
  happy:   { bpm: 116, root: 60, scale: [0, 2, 4, 7, 9],  prog: [[0, 4, 7], [5, 9, 12], [9, 12, 16], [7, 11, 14]], wave: 'triangle', dens: 0.7, kick: true },
  calm:    { bpm: 76,  root: 57, scale: [0, 2, 4, 7, 9],  prog: [[0, 4, 7, 11], [5, 9, 12, 16], [2, 5, 9, 12], [7, 11, 14, 17]], wave: 'sine', dens: 0.35 },
  neutral: { bpm: 92,  root: 62, scale: [0, 2, 4, 7, 9],  prog: [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]], wave: 'triangle', dens: 0.5 },
  tired:   { bpm: 66,  root: 55, scale: [0, 2, 4, 7, 9],  prog: [[0, 4, 7, 11], [5, 9, 12, 16]], wave: 'sine', dens: 0.25 },
  anxious: { bpm: 60,  root: 57, scale: [0, 2, 4, 7, 9],  prog: [[0, 7, 12, 16], [5, 12, 16, 19], [-3, 4, 9, 12], [2, 9, 14, 17]], wave: 'sine', dens: 0.22 },
  sad:     { bpm: 70,  root: 57, scale: [0, 3, 5, 7, 10], prog: [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]], wave: 'sine', dens: 0.35 },
  angry:   { bpm: 98,  root: 52, scale: [0, 3, 5, 7, 10], prog: [[0, 3, 7], [10, 14, 17], [8, 12, 15], [7, 10, 14]], wave: 'sawtooth', dens: 0.55, kick: true },
};

const freq = (n: number) => 440 * 2 ** ((n - 69) / 12);
const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
export const hashStr = (s: string, h0 = 7) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, h0);

let ctx: AudioContext | null = null;
let bus: GainNode | null = null, padIn: BiquadFilterNode, leadIn: GainNode;
let timer: ReturnType<typeof setInterval> | null = null;
let nextT = 0, step = 0, prof: Profile, motif: (number | null)[], stepDur = 0;

function note(n: number, t: number, dur: number, type: OscillatorType, vol: number, dest: AudioNode, attack: number) {
  const o = ctx!.createOscillator(), g = ctx!.createGain();
  o.type = type; o.frequency.value = freq(n);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
}
function kick(t: number) {
  const o = ctx!.createOscillator(), g = ctx!.createGain();
  o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.15);
  g.gain.setValueAtTime(0.45, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
  o.connect(g); g.connect(bus!); o.start(t); o.stop(t + 0.3);
}
function playStep(s: number, t: number) {
  const inBar = s % 8, barDur = stepDur * 8;
  if (inBar === 0) {
    const ch = prof.prog[Math.floor(s / 8) % prof.prog.length];
    ch.forEach(n => note(prof.root + n, t, barDur * 1.05, prof.wave, 0.04, padIn, 0.35));
    note(prof.root + ch[0] - 12, t, barDur * 0.9, 'sine', 0.1, bus!, 0.02);
  }
  const m = motif[s % 16]; if (m != null) note(prof.root + 12 + m, t, stepDur * 1.8, 'triangle', 0.06, leadIn, 0.01);
  if (prof.kick && inBar % 4 === 0) kick(t);
}

export function stopMusic() {
  if (timer) clearInterval(timer); timer = null;
  if (bus && ctx) { const b = bus; b.gain.setTargetAtTime(0, ctx.currentTime, 0.05); setTimeout(() => b.disconnect(), 400); bus = null; }
}

export function startMusic(mood: string, seedStr: string, offset = 0) {
  stopMusic();
  ctx = ctx || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  void ctx.resume();
  prof = PROF[mood] || PROF.neutral; stepDur = 60 / prof.bpm / 2;
  const r = rng(hashStr(seedStr));
  motif = [...Array(16)].map(() => (r() < prof.dens ? prof.scale[Math.floor(r() * prof.scale.length)] + (r() < 0.25 ? 12 : 0) : null));
  // Нэг session-ий бүх дуу нэг bus-аар дамжина → pause хийхэд бүгд зөөлөн чимээгүй болно
  bus = ctx.createGain(); bus.gain.value = 0.9; bus.connect(ctx.destination);
  padIn = ctx.createBiquadFilter(); padIn.type = 'lowpass'; padIn.frequency.value = prof.wave === 'sawtooth' ? 700 : 1400; padIn.connect(bus);
  leadIn = ctx.createGain(); leadIn.connect(bus);
  const dl = ctx.createDelay(), fb = ctx.createGain(), wet = ctx.createGain();
  dl.delayTime.value = stepDur * 3; fb.gain.value = 0.3; wet.gain.value = 0.3;
  leadIn.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(bus);
  step = Math.floor(offset / stepDur); nextT = ctx.currentTime + 0.06;
  timer = setInterval(() => { while (nextT < ctx!.currentTime + 0.12) { playStep(step++, nextT); nextT += stepDur; } }, 25);
}
