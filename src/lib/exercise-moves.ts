/* ---------- 3D дасгалын хөдөлгөөн ----------
   Анимаци бүр нь давталтын явц (0..1)-аас биеийн байрлал гаргадаг цэвэр функц. three.js-ээс хамаарахгүй.
   Өнцгийг градусаар. Загвар +Z руу харж зогсоно, зүүн гар нь +X талд:
   - мөр/гуя x: хасах = урагш өргөх;  мөр/гуя z: зүүн талд нэмэх = хажуу тийш өргөх
   - тохой x: хасах = нугалах;  өвдөг x: нэмэх = нугалах
   - нуруу/хүзүү x: нэмэх = урагш бөхийх;  z: нэмэх = баруун тийш хазайх */

export type V3 = [number, number, number];
export const JOINTS = ['root', 'spine', 'chest', 'neck', 'shL', 'shR', 'elL', 'elR', 'wrL', 'wrR', 'hipL', 'hipR', 'knL', 'knR', 'anL', 'anR'] as const;
export type Joint = (typeof JOINTS)[number];
const SCALARS = ['lift', 'dz', 'shrug', 'fwd', 'breath', 'glow'] as const;
type Scalar = (typeof SCALARS)[number];
/** lift: газраас дээш (үсрэлт), dz: камерын төвд авчрах шилжилт, shrug/fwd: мөр дээш/урагш, breath: цээж тэлэх, glow: ачаалагдаж буй булчин тодрох */
export type Pose = Record<Joint, V3> & Record<Scalar, number>;

export type Region = 'legs' | 'core' | 'arms' | 'shoulders' | 'head';
export type View = 'front' | 'angle' | 'side' | 'floor';

const ZERO: V3 = [0, 0, 0];
const clamp = (t: number) => Math.min(1, Math.max(0, t));
const smooth = (t: number) => t * t * (3 - 2 * t);
/** p нь a..b дотор 0→1 зөөлөн өснө */
const seg = (p: number, a: number, b: number) => smooth(clamp((p - a) / (b - a)));
/** 0→1→0 долгион */
const wave = (p: number) => 0.5 - 0.5 * Math.cos(2 * Math.PI * p);
const rad = (d: number) => (d * Math.PI) / 180, deg = (r: number) => (r * 180) / Math.PI;

function pose(over: Partial<Pose> = {}): Pose {
  const p = {} as Pose;
  for (const j of JOINTS) p[j] = ZERO;
  for (const s of SCALARS) p[s] = 0;
  return Object.assign(p, over);
}

/** Зүүн, баруун талыг тэгш хэмтэй: баруун тал нь y, z-ийн тэмдэг эсрэг */
const both = (l: 'shL' | 'elL' | 'wrL' | 'hipL' | 'knL' | 'anL', v: V3): Partial<Pose> =>
  ({ [l]: v, [l.slice(0, -1) + 'R']: [v[0], -v[1], -v[2]] as V3 });

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function mixPose(a: Pose, b: Pose, t: number): Pose {
  const o = pose();
  for (const j of JOINTS) o[j] = [lerp(a[j][0], b[j][0], t), lerp(a[j][1], b[j][1], t), lerp(a[j][2], b[j][2], t)];
  for (const s of SCALARS) o[s] = lerp(a[s], b[s], t);
  return o;
}

const STAND = { ...both('shL', [0, 0, 7]), ...both('elL', [-10, 0, 0]) };
/** Өвдөг сөхрөн өсгий дээрээ суух */
const KNEEL = { ...both('hipL', [-86, 0, 0]), ...both('knL', [166, 0, 0]), ...both('anL', [62, 0, 0]), ...both('shL', [-6, 0, 5]), ...both('elL', [-38, 0, 0]), dz: -0.22 };
/* Түлхэлт, планк: хөлийн хуруу, гар газарт бэхлэгдсэн тул биеийн налуу, гарын нугаралтыг геометрээр тооцно */
const ARM_A = 0.29, ARM_B = 0.27, BODY = 1.38;
function plankAt(h: number): Partial<Pose> {
  const tilt = deg(Math.asin(h / BODY)), root = 90 - tilt;
  const d = Math.min(h, ARM_A + ARM_B - 0.001);
  const up = deg(Math.acos((ARM_A ** 2 + d ** 2 - ARM_B ** 2) / (2 * ARM_A * d)));
  const fore = deg(Math.acos((ARM_B ** 2 + d ** 2 - ARM_A ** 2) / (2 * ARM_B * d)));
  return {
    root: [root, 0, 0], neck: [-22, 0, 0], dz: -0.78,
    ...both('shL', [up - root, 0, 3]), ...both('elL', [-fore - up, 0, 0]), ...both('wrL', [fore - 80, 0, 0]),
    ...both('anL', [-8, 0, 0]),
  };
}

/** Булчингаа чангалаад (эхний 1/3) сулла. Хоёр байрлалын хооронд шилжинэ. */
const tense = (active: Partial<Pose>, relaxed: Partial<Pose> = STAND) => (p: number) => {
  const t = seg(p, 0, 0.06) * (1 - seg(p, 1 / 3, 0.4));
  return mixPose(pose({ ...STAND, ...relaxed, breath: wave(p) * 0.6 }), pose({ ...STAND, ...active, glow: 1 }), t);
};

export const ANIMS = {
  idle: (p: number) => pose({ ...STAND, breath: wave(p) }),
  walk: (p: number) => {
    const s = Math.sin(2 * Math.PI * p), c = Math.cos(2 * Math.PI * p);
    const knee = (x: number) => 8 + 58 * Math.max(0, x);
    return pose({
      spine: [3, 0, 0], chest: [0, 8 * s, 0], root: [0, -5 * s, 0],
      shL: [26 * s, 0, 6], shR: [-26 * s, 0, -6], elL: [-22 - 8 * s, 0, 0], elR: [-22 + 8 * s, 0, 0],
      hipL: [-24 * s - 6, 0, 0], hipR: [24 * s - 6, 0, 0], knL: [knee(c), 0, 0], knR: [knee(-c), 0, 0],
      anL: [-6 * s, 0, 0], anR: [6 * s, 0, 0],
    });
  },
  // Гар, хөлөө алцайлган үсрэх
  jack: (p: number) => {
    const o = wave(p);
    return pose({
      lift: 0.07 * Math.abs(Math.sin(2 * Math.PI * p)), ...both('shL', [0, 0, lerp(8, 168, o)]), ...both('elL', [-12, 0, 0]),
      ...both('hipL', [0, 0, lerp(1, 20, o)]), ...both('anL', [0, 0, -lerp(1, 20, o)]),
    });
  },
  squat: (p: number) => {
    const d = smooth(wave(p)), a = 100 * d, s = 38 * d, r = 34 * d;
    return pose({
      root: [r, 0, 0], neck: [-r * 0.7, 0, 0], spine: [-6 * d, 0, 0],
      ...both('hipL', [-a - r, 0, 4]), ...both('knL', [a + s, 0, 0]), ...both('anL', [-s, 0, 0]),
      ...both('shL', [-88 * d - r, 0, lerp(7, 3, d)]), ...both('elL', [lerp(-10, -4, d), 0, 0]),
    });
  },
  pushup: (p: number) => pose(plankAt(lerp(0.53, 0.2, smooth(wave(p))))),
  plank: (p: number) => pose({ ...plankAt(0.53), breath: wave(p) * 0.5, glow: 0.45 }),
  // Нэг давталт: баруун тийш, төв, зүүн тийш, төв
  neckTilt: (p: number) => pose({ ...STAND, neck: [0, 0, 32 * Math.sin(2 * Math.PI * p)], chest: [0, 0, 4 * Math.sin(2 * Math.PI * p)], glow: 0.5 }),
  shoulderRoll: (p: number) => pose({ ...STAND, shrug: 0.5 + 0.5 * Math.sin(2 * Math.PI * p), fwd: Math.cos(2 * Math.PI * p), glow: 0.5 }),
  // Дөрвөн мөч: муур (нуруу бөгтийлгөх) ↔ үнээ (нуруу хотойлгох)
  catCow: (p: number) => {
    const c = Math.sin(2 * Math.PI * p), spine = 14 * c, chest = 14 * c;
    return pose({
      root: [90, 0, 0], spine: [spine, 0, 0], chest: [chest, 0, 0], neck: [24 * c - 12, 0, 0], dz: -0.5, breath: 0.5 - c / 2, glow: 0.4,
      ...both('hipL', [-90, 0, 3]), ...both('knL', [90, 0, 0]), ...both('anL', [64, 0, 0]),
      ...both('shL', [-90 - spine - chest, 0, 3]), ...both('elL', [-3, 0, 0]), ...both('wrL', [-80, 0, 0]),
    });
  },
  // Хүүхдийн байрлал: өвдөг сөхрөөд урагш сунаж амрах
  child: (p: number) => pose({
    root: [66, 0, 0], spine: [12, 0, 0], chest: [10, 0, 0], neck: [-2, 0, 0], dz: -0.42, breath: wave(p),
    ...both('hipL', [-152, 0, 4]), ...both('knL', [166, 0, 0]), ...both('anL', [62, 0, 0]),
    ...both('shL', [-176, 0, 8]), ...both('elL', [-4, 0, 0]), ...both('wrL', [-8, 0, 0]),
  }),
  tenseLegs: tense({ ...both('hipL', [-14, 0, 2]), ...both('knL', [26, 0, 0]), ...both('anL', [-12, 0, 0]) }),
  tenseCore: tense({ spine: [10, 0, 0], chest: [8, 0, 0], ...both('shL', [-14, 0, 12]), ...both('elL', [-70, 0, 0]) }),
  tenseArms: tense({ ...both('shL', [-38, 0, 16]), ...both('elL', [-132, 0, 0]), ...both('wrL', [-20, 0, 0]) }),
  tenseShoulders: tense({ shrug: 1.15, fwd: 0.2 }),
  tenseFace: tense({ neck: [8, 0, 0] }),
  // Суугаад тайван амьсгалах
  sitBreath: (p: number) => { const b = wave(p); return pose({ ...KNEEL, breath: b, shrug: b * 0.3, neck: [5 - 7 * b, 0, 0] }); },
  // Хайрцаг амьсгал: 4 тоолж авах, барих, гаргах, хоосон барих (нэг давталт 16 секунд)
  boxBreath: (p: number) => { const b = seg(p, 0, 0.25) * (1 - seg(p, 0.5, 0.75)); return pose({ ...KNEEL, breath: b, shrug: b * 0.35, neck: [5 - 8 * b, 0, 0] }); },
  // Эргэн тойрноо ажиглах
  lookAround: (p: number) => { const s = Math.sin(2 * Math.PI * p); return pose({ ...STAND, neck: [0, 45 * s, 0], chest: [0, 10 * s, 0], breath: wave(p) * 0.5 }); },
  // Бүжиглэх: дүүжлэх, гараа өргөх, бага зэрэг үсрэх
  dance: (p: number) => {
    const s = Math.sin(2 * Math.PI * p);
    return pose({
      root: [0, 0, 6 * s], spine: [0, 0, -6 * s], neck: [0, 0, 8 * s], lift: 0.04 * Math.abs(Math.sin(4 * Math.PI * p)),
      shL: [-20, 0, 120 + 40 * s], shR: [-20, 0, -(120 - 40 * s)], elL: [-40, 0, 0], elR: [-40, 0, 0],
      ...both('hipL', [0, 0, 4]), knL: [10 + 18 * Math.max(0, s), 0, 0], knR: [10 + 18 * Math.max(0, -s), 0, 0],
    });
  },
  // Гараа дээш сунгаж, хажуу тийш хазайх
  stretchUp: (p: number) => { const s = Math.sin(2 * Math.PI * p); return pose({ ...both('shL', [-5, 0, 168]), ...both('elL', [-8, 0, 0]), chest: [0, 0, 10 * s], spine: [0, 0, 6 * s], breath: wave(p) }); },
  // Суугаад бичих
  write: (p: number) => pose({
    ...KNEEL, spine: [18, 0, 0], chest: [10, 0, 0], neck: [22, 0, 0],
    shR: [-58, 0, -8 + 5 * Math.cos(4 * Math.PI * p)], elR: [-62 + 6 * Math.sin(4 * Math.PI * p), 0, 0], wrR: [-10, 0, 0],
    shL: [-48, 0, 12], elL: [-70, 0, 0],
  }),
  // Эргэцүүлэх: гараа эрүүндээ хүргэх
  think: (p: number) => pose({ ...STAND, shR: [-38, 0, -18], elR: [-140, 0, 0], shL: [-28, 0, 18], elL: [-95, 0, 0], neck: [6 + 3 * Math.sin(2 * Math.PI * p), 0, -10], breath: wave(p) * 0.5 }),
  // Ярилцах: гараараа дохих
  talk: (p: number) => { const s = Math.sin(2 * Math.PI * p), c = Math.cos(2 * Math.PI * p); return pose({ ...STAND, shL: [-25, 0, 12], shR: [-25, 0, -12], elL: [-65 - 25 * s, 0, 0], elR: [-65 - 25 * c, 0, 0], neck: [4 * Math.sin(4 * Math.PI * p), 6 * s, 0] }); },
  // Нүүрээ угаах
  washFace: (p: number) => { const s = Math.sin(2 * Math.PI * p); return pose({ spine: [22, 0, 0], chest: [10, 0, 0], neck: [12, 0, 0], ...both('shL', [-110 + 12 * s, 0, 22]), ...both('elL', [-125, 0, 0]) }); },
  // Гар даллах
  wave: (p: number) => pose({ ...STAND, shR: [0, 0, -150], elR: [-25, 0, 25 * Math.sin(2 * Math.PI * p)], neck: [0, 0, 6], breath: wave(p) * 0.5 }),
  // Баярлах: гараа өргөөд үсрэх
  cheer: (p: number) => { const o = wave(p); return pose({ lift: 0.06 * Math.abs(Math.sin(2 * Math.PI * p)), ...both('shL', [0, 0, 120 + 30 * o]), ...both('elL', [-15, 0, 0]), neck: [-8, 0, 0] }); },
} satisfies Record<string, (p: number) => Pose>;

export type AnimId = keyof typeof ANIMS;

/** Биеийн аль хэсэг тодрох */
export const ANIM_REGION: Partial<Record<AnimId, Region[]>> = {
  plank: ['core', 'arms'], neckTilt: ['head', 'shoulders'], shoulderRoll: ['shoulders'], catCow: ['core'],
  tenseLegs: ['legs'], tenseCore: ['core'], tenseArms: ['arms'], tenseShoulders: ['shoulders'], tenseFace: ['head'],
};

export type Cue = [from: number, text: string];
export type Move = {
  label: string;
  anim: AnimId;
  /** Нэг давталтын секунд */
  period: number;
  reps: number;
  /** Давталт тоолохгүй, үлдсэн хугацаа харуулах */
  hold?: boolean;
  view?: View;
  /** Давталт дотор солигдох заавар: [эхлэх явц, текст] */
  cues?: Cue[];
};

export const moveSeconds = (m: Move) => m.period * m.reps;
export const PREP_SECONDS = 3;
/** Бэлтгэлийн хугацаатай нийт секунд */
export const totalSeconds = (moves: Move[]) => moves.reduce((s, m) => s + moveSeconds(m) + PREP_SECONDS, 0);

/** Давталтын явцад тохирох заавар */
export function cueAt(m: Move, t: number) {
  if (!m.cues) return null;
  const p = (t % m.period) / m.period;
  return m.cues.findLast(([from]) => p >= from)?.[1] ?? null;
}

export { rad };

const rounds = (moves: Move[], n: number) => Array.from({ length: n }, () => moves).flat();
const SQUEEZE: Cue[] = [[0, 'Чангал'], [1 / 3, 'Сулла, амьсгаа гарга']];
const squeeze = (label: string, anim: AnimId): Move => ({ label, anim, period: 15, reps: 3, cues: SQUEEZE });

/** Биеэр хийдэг дасгалуудын алхмууд. Шинээр нэмбэл RECS дахь sub-ийн минутыг totalSeconds-тэй тааруулна. */
export const EXERCISE_MOVES = {
  e3: [
    { label: 'Утсаа чимээгүй горимд тавь', anim: 'idle', period: 5, reps: 2, hold: true },
    { label: 'Гадаа гараад тайван алх', anim: 'walk', period: 1.2, reps: 250, hold: true, view: 'angle' },
    { label: 'Эргэн тойрныхоо өнгө, дууг ажиглан алх', anim: 'walk', period: 1.2, reps: 250, hold: true, view: 'angle' },
  ],
  e4: rounds([
    { label: 'Хүзүүгээ зүүн, баруун тийш хазайлга', anim: 'neckTilt', period: 8, reps: 5 },
    { label: 'Мөрөө эргүүл', anim: 'shoulderRoll', period: 4, reps: 10, view: 'angle' },
    { label: 'Муур-үнээ байрлал', anim: 'catCow', period: 7, reps: 8, view: 'floor', cues: [[0, 'Нуруугаа бөгтийлгө'], [0.5, 'Нуруугаа хотойлго']] },
    { label: 'Хүүхдийн байрлалд амар', anim: 'child', period: 5, reps: 12, hold: true, view: 'floor' },
  ], 2),
  e6: [
    squeeze('Хөлийн булчингаа чангал', 'tenseLegs'),
    squeeze('Гэдэсний булчингаа чангал', 'tenseCore'),
    squeeze('Гар, нударгаа чангал', 'tenseArms'),
    squeeze('Мөрөө чихэндээ ойртуул', 'tenseShoulders'),
    squeeze('Нүдээ аньж, нүүрээ чангал', 'tenseFace'),
  ],
  e7: rounds([
    { label: 'Гар, хөлөө алцайлган үсэр', anim: 'jack', period: 1.5, reps: 20 },
    { label: 'Суулт', anim: 'squat', period: 3, reps: 15, view: 'side' },
    { label: 'Түлхэлт', anim: 'pushup', period: 3, reps: 10, view: 'floor' },
    { label: 'Планк: биеэ шулуун барь', anim: 'plank', period: 5, reps: 6, hold: true, view: 'floor' },
    { label: 'Амсхийгээд ус уу', anim: 'idle', period: 5, reps: 6, hold: true },
  ], 3),
} satisfies Record<string, Move[]>;
