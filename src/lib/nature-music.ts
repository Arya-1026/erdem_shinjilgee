/* Иогийн тайвшруулах байгалийн ая (claude.ai «nature-music.js»-ээс). Web Audio, файл, сан шаардлагагүй.
   Горхи + дусал, салхи, 3 төрлийн шувуу, 16 сек тутам солигдох зөөлөн аккорд, калимба аялгуу.
     const music = createNatureMusic();  // товч дарсны дараа (хөтчийн дүрэм)
     music.start(); music.pause(); music.resume();
     music.rep();   // давталт бүрийн эхэнд: аккорд «амьсгал авна» + жижиг хонх
     music.step();  // дараагийн дасгал руу: хоёр нотын хонх
     music.tense(at, sec); music.release(at);  // булчин чангалах / суллах үе (PMR)
     createNatureMusic({ preset: 'waves' })     // горхины оронд далайн давалгаа (хэвтээ дасгалд)
     music.setVolume(0..1); music.stop(); */

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CHORDS = [
  [146.83, 220.0, 277.18, 329.63, 440.0], // Dmaj9
  [123.47, 185.0, 246.94, 293.66, 369.99], // Bm7
  [98.0, 196.0, 246.94, 293.66, 369.99], // Gmaj7
  [110.0, 164.81, 220.0, 277.18, 329.63], // A6/9
];
const PENTA = [587.33, 659.25, 739.99, 880.0, 987.77, 1174.66];
const CHORD_LEN = 16;

export type NatureMusic = ReturnType<typeof createNatureMusic>;

export function createNatureMusic(opts: { volume?: number; seed?: number; preset?: 'stream' | 'waves' } = {}) {
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  const WAVES = opts.preset === 'waves';
  const rnd = mulberry32(opts.seed ?? Date.now() % 100000);
  const R = (a: number, b: number) => a + (b - a) * rnd();
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];

  const master = ctx.createGain(); master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 2;
  master.connect(comp).connect(ctx.destination);
  let volume = opts.volume ?? 0.9;

  const rev = ctx.createConvolver();
  {
    const len = Math.floor(ctx.sampleRate * 3.2), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (rnd() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    rev.buffer = ir;
  }
  const revOut = ctx.createGain(); revOut.gain.value = 0.5;
  rev.connect(revOut).connect(master);

  const musicG = ctx.createGain(); musicG.gain.value = 0.7;
  musicG.connect(master); musicG.connect(rev);

  function noiseBuffer(sec: number, color: 'brown' | 'pink') {
    const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * sec), ctx.sampleRate), d = b.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = rnd() * 2 - 1;
      if (color === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else { b0 = 0.997 * b0 + 0.029591 * w; b1 = 0.985 * b1 + 0.032534 * w; b2 = 0.95 * b2 + 0.048056 * w; d[i] = (b0 + b1 + b2 + 0.1848 * w) * 0.5; }
    }
    return b;
  }
  const pan = (node: AudioNode, p: number): AudioNode => {
    if (!ctx.createStereoPanner) return node;
    const s = ctx.createStereoPanner(); s.pan.value = p; node.connect(s); return s;
  };

  // Тасралтгүй дэвсгэр: горхи, салхи
  let wind: GainNode | null = null, windF: BiquadFilterNode | null = null;
  let sea: GainNode | null = null, seaF: BiquadFilterNode | null = null;
  function startBeds(t: number) {
    if (WAVES) {
      const s = ctx.createBufferSource(); s.buffer = noiseBuffer(11, 'brown'); s.loop = true;
      seaF = ctx.createBiquadFilter(); seaF.type = 'lowpass'; seaF.frequency.value = 320;
      sea = ctx.createGain(); sea.gain.value = 0.05;
      s.connect(seaF).connect(sea).connect(master);
      const foam = ctx.createBufferSource(); foam.buffer = noiseBuffer(6, 'pink'); foam.loop = true;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
      const fg = ctx.createGain(); fg.gain.value = 0.012;
      foam.connect(hp).connect(fg).connect(master);
      s.start(t); foam.start(t);
    } else {
    const water = ctx.createBufferSource(); water.buffer = noiseBuffer(7, 'pink'); water.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 950; bp.Q.value = 0.55;
    const wg = ctx.createGain(); wg.gain.value = 0.09;
    water.connect(bp).connect(wg).connect(master);
    const sparkle = ctx.createBiquadFilter(); sparkle.type = 'highpass'; sparkle.frequency.value = 3200;
    const sg = ctx.createGain(); sg.gain.value = 0.03;
    water.connect(sparkle).connect(sg).connect(master);
    water.start(t);
    }

    const air = ctx.createBufferSource(); air.buffer = noiseBuffer(9, 'brown'); air.loop = true;
    windF = ctx.createBiquadFilter(); windF.type = 'lowpass'; windF.frequency.value = 380;
    wind = ctx.createGain(); wind.gain.value = 0.05;
    air.connect(windF).connect(wind).connect(master);
    air.start(t);
  }

  function drop(t: number) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = R(480, 1250);
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * R(1.4, 1.9), t + 0.045);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(R(0.012, 0.035), t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    pan(o.connect(g), R(-0.6, 0.6)).connect(master);
    o.start(t); o.stop(t + 0.07);
  }

  function birdNote(t: number, f0: number, f1: number, dur: number, amp: number, p: number, wet: number) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(amp, t + dur * 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const n = pan(o.connect(g), p); n.connect(master);
    const send = ctx.createGain(); send.gain.value = wet; n.connect(send).connect(rev);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function bird(t: number) {
    const p = R(-0.85, 0.85), amp = R(0.018, 0.05), wet = R(0.3, 0.9), kind = rnd();
    if (kind < 0.4) { // жиргээ
      const n = 2 + Math.floor(R(0, 5)), base = R(2800, 3800);
      for (let i = 0; i < n; i++) birdNote(t + i * R(0.1, 0.15), base * 1.25, base * 0.85, 0.08, amp, p, wet);
    } else if (kind < 0.75) { // хоёр нотын исгэрээ
      const f = R(3300, 4100);
      birdNote(t, f, f * 0.98, 0.28, amp, p, wet);
      birdNote(t + 0.34, f * 0.84, f * 0.82, 0.36, amp * 0.9, p, wet);
    } else { // зөөлөн триль
      const o = ctx.createOscillator(), m = ctx.createOscillator(), md = ctx.createGain(), g = ctx.createGain();
      const f = R(3600, 4600), d = R(0.5, 0.9);
      o.frequency.value = f; m.frequency.value = R(22, 32); md.gain.value = f * 0.12;
      m.connect(md).connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(amp * 0.7, t + 0.08);
      g.gain.setValueAtTime(amp * 0.7, t + d - 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      const n = pan(o.connect(g), p); n.connect(master);
      const s = ctx.createGain(); s.gain.value = wet; n.connect(s).connect(rev);
      o.start(t); m.start(t); o.stop(t + d + 0.02); m.stop(t + d + 0.02);
    }
  }

  // Нэг далайн давалгаа орж ирээд буцна
  function wave(t: number, size = 1) {
    if (!sea || !seaF) return 8;
    const up = R(3, 4.5) * size, down = R(4, 6) * size, peak = R(0.18, 0.26) * size;
    sea.gain.cancelScheduledValues(t);
    sea.gain.setTargetAtTime(peak, t, up / 3);
    sea.gain.setTargetAtTime(0.04, t + up, down / 3);
    seaF.frequency.cancelScheduledValues(t);
    seaF.frequency.setTargetAtTime(R(800, 1100), t, up / 3);
    seaF.frequency.setTargetAtTime(300, t + up, down / 3);
    return up + down;
  }

  function pluck(t: number, f: number, amp: number) { // калимба
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(amp, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    for (const [m, a] of [[1, 1], [2.0, 0.18], [5.4, 0.04]]) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.frequency.value = f * m; og.gain.value = a; o.connect(og).connect(g);
      o.start(t); o.stop(t + 2.3);
    }
    g.connect(musicG);
  }
  function bell(t: number, f: number, amp: number) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(amp, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 3.8);
    for (const [m, a] of [[1, 1], [2.01, 0.25], [3.0, 0.08]]) {
      const o = ctx.createOscillator(), og = ctx.createGain();
      o.frequency.value = f * m; og.gain.value = a; o.connect(og).connect(g);
      o.start(t); o.stop(t + 3.9);
    }
    g.connect(master); g.connect(rev);
  }

  let chordIdx = 0;
  function chord(t: number) {
    const notes = CHORDS[chordIdx++ % CHORDS.length];
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + 3);
    g.gain.setValueAtTime(1, t + CHORD_LEN - 1); g.gain.linearRampToValueAtTime(0.0001, t + CHORD_LEN + 2);
    notes.forEach((f, i) => {
      for (const [type, det, a] of [['sine', -5, 0.045], ['triangle', 6, 0.022]] as const) {
        const o = ctx.createOscillator(), og = ctx.createGain();
        o.type = type; o.frequency.value = f; o.detune.value = det + i; og.gain.value = a;
        o.connect(og).connect(lp); o.start(t); o.stop(t + CHORD_LEN + 2.1);
      }
    });
    lp.connect(g).connect(musicG);
  }

  // Төлөвлөгч: дараагийн 1.5 секундын үйл явдлыг урьдчилж тавина
  let nextWave = 0, nextDrop = 0, nextBird = 0, nextNote = 0, nextChord = 0, nextWind = 0;
  function scheduleTo(until: number) {
    if (WAVES) { while (nextWave < until) nextWave += wave(nextWave) * R(0.9, 1.15); }
    else { while (nextDrop < until) { drop(nextDrop); nextDrop += R(0.07, 0.45); } }
    while (nextBird < until) { if (!WAVES || rnd() < 0.5) bird(nextBird); nextBird += WAVES ? R(6, 14) : R(2.5, 8); }
    while (nextChord < until) { chord(nextChord); nextChord += CHORD_LEN; }
    while (nextNote < until) {
      if (rnd() < 0.7) pluck(nextNote, pick(PENTA), R(0.045, 0.075));
      nextNote += pick([1.5, 2, 2, 3, 4]);
    }
    while (nextWind < until) {
      wind?.gain.linearRampToValueAtTime(R(0.025, 0.1), nextWind + 3);
      windF?.frequency.linearRampToValueAtTime(R(260, 520), nextWind + 3);
      nextWind += 3;
    }
  }

  let timer: ReturnType<typeof setInterval> | undefined, started = false, closed = false;
  return {
    start() {
      if (started) return; started = true;
      const t = ctx.currentTime + 0.05;
      void ctx.resume();
      startBeds(t);
      nextWave = t + 0.5; nextDrop = t + 0.3; nextBird = t + 1.2; nextNote = t + 2; nextChord = t; nextWind = t;
      master.gain.setValueAtTime(0, t); master.gain.linearRampToValueAtTime(volume, t + 2.5);
      scheduleTo(t + 1.5);
      timer = setInterval(() => scheduleTo(ctx.currentTime + 1.5), 300);
    },
    pause() { if (!closed) void ctx.suspend(); },
    resume() { if (!closed) void ctx.resume(); },
    rep() {
      if (closed) return;
      const t = ctx.currentTime;
      musicG.gain.cancelScheduledValues(t);
      musicG.gain.setValueAtTime(0.6, t);
      musicG.gain.linearRampToValueAtTime(1.0, t + 3.2);
      musicG.gain.setValueAtTime(1.0, t + 5);
      musicG.gain.linearRampToValueAtTime(0.6, t + 8);
      bell(t, 1174.66, 0.04);
    },
    step(at?: number) {
      if (closed) return;
      const t = Math.max(at ?? 0, ctx.currentTime);
      bell(t, 587.33, 0.07); bell(t + 0.3, 880.0, 0.06);
    },
    tense(at?: number, sec = 7) {
      if (closed) return;
      const t = Math.max(at ?? 0, ctx.currentTime);
      musicG.gain.cancelScheduledValues(t);
      musicG.gain.setValueAtTime(0.5, t);
      musicG.gain.linearRampToValueAtTime(0.95, t + sec);
      bell(t, 659.25, 0.045); bell(t + 0.18, 880.0, 0.03);
    },
    release(at?: number) {
      if (closed) return;
      const t = Math.max(at ?? 0, ctx.currentTime);
      musicG.gain.cancelScheduledValues(t);
      musicG.gain.setValueAtTime(0.95, t);
      musicG.gain.linearRampToValueAtTime(0.55, t + 9);
      [1174.66, 987.77, 880.0, 739.99, 587.33].forEach((f, i) => bell(t + i * 0.16, f, 0.05 - i * 0.006));
      if (WAVES) { wave(t + 0.2, 1.25); nextWave = Math.max(nextWave, t + 10); }
    },
    /** Дуутай синк хийх цаг (зогсоосон үед зогсоно) */
    now: () => ctx.currentTime,
    setVolume(v: number) { volume = v; if (!closed) master.gain.setTargetAtTime(v, ctx.currentTime, 0.2); },
    stop() {
      if (closed) return; closed = true;
      clearInterval(timer);
      void ctx.resume();
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
      setTimeout(() => void ctx.close(), 2000);
    },
  };
}
