import * as THREE from 'three';
import { rad, type Joint, type Pose, type Region } from '@/lib/exercise-moves';

/* Дасгал үзүүлэх 3D дүр (хүн, муур, туулай): үе мөч бүр нь Group, биеийн хэсгүүдийг хэлбэрт оруулсан mesh.
   Гадны модель файл шаардахгүй. Гурвуулаа ижил араг ястай тул бүх хөдөлгөөн (ANIMS) адилхан ажиллана. */
import type { Character } from './character';

const SKIN = '#E7B892', TOP = '#2F7A6B', SHORTS = '#2F3A4A', SHOE = '#F4F1EA', HAIR = '#2B2724';
const GLOW = new THREE.Color('#FF7A45');

/** Гөлгөр, нарийссан хэлбэр: дээд төгсгөл y=0, доод төгсгөл y=-len. Дунд хэсэг нь bulge-ээр товойно. */
function limbGeo(len: number, r1: number, r2: number, bulge = 0) {
  const pts: THREE.Vector2[] = [];
  const N = 7, M = 14;
  for (let i = 0; i <= N; i++) { const a = (i / N) * Math.PI / 2; pts.push(new THREE.Vector2(r2 * Math.sin(a), -len - r2 * Math.cos(a))); }
  for (let i = 1; i < M; i++) { const t = 1 - i / M; pts.push(new THREE.Vector2(r1 + (r2 - r1) * t + bulge * Math.sin(Math.PI * t), -len * t)); }
  for (let i = 0; i <= N; i++) { const a = (i / N) * Math.PI / 2; pts.push(new THREE.Vector2(r1 * Math.cos(a), r1 * Math.sin(a))); }
  return new THREE.LatheGeometry(pts, 24);
}

export type Rig = {
  root: THREE.Group;
  joints: Record<Joint, THREE.Group>;
  apply: (p: Pose, regions: Region[] | undefined, time: number) => void;
};

export function buildMannequin(kind: Character = 'human'): Rig {
  if (kind !== 'human') return buildAnimal(kind);
  // Цамц хэрэглэгчийн сонгосон өнгөөр
  const top = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || TOP;
  const mats = new Map<Region, THREE.MeshStandardMaterial[]>();
  const mat = (color: string, region: Region) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.02, emissive: GLOW, emissiveIntensity: 0 });
    mats.set(region, [...(mats.get(region) ?? []), m]);
    return m;
  };
  const skinLeg = mat(SKIN, 'legs'), skinArm = mat(SKIN, 'arms'), skinHead = mat(SKIN, 'head');
  const shirt = mat(top, 'core'), sleeve = mat(top, 'shoulders'), shorts = mat(SHORTS, 'core'), shoe = mat(SHOE, 'legs');
  const hair = new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.8 });

  const mesh = (geo: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, pos?: [number, number, number], scale?: [number, number, number]) => {
    const o = new THREE.Mesh(geo, m);
    o.castShadow = true;
    if (pos) o.position.set(...pos);
    if (scale) o.scale.set(...scale);
    parent.add(o);
    return o;
  };
  const joint = (parent: THREE.Object3D, x: number, y: number, z = 0) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };

  const root = new THREE.Group();
  // Их бие
  mesh(limbGeo(0.1, 0.135, 0.15, 0.012), shorts, root, [0, 0.07, 0], [1.05, 1, 0.74]);
  const spine = joint(root, 0, 0.08);
  mesh(limbGeo(0.13, 0.145, 0.125), shirt, spine, [0, 0.15, 0], [1, 1, 0.72]);
  const chest = joint(spine, 0, 0.17);
  const ribs = mesh(limbGeo(0.2, 0.122, 0.128, 0.022), shirt, chest, [0, 0.235, 0.004], [1.16, 1, 0.74]);

  // Толгой, нүүрний чиг нь мэдэгдэхийн тулд үс, хамар, нүд
  const neck = joint(chest, 0, 0.3);
  mesh(limbGeo(0.07, 0.052, 0.058), skinHead, neck, [0, 0.05, 0]);
  const skull = new THREE.SphereGeometry(0.105, 32, 24);
  mesh(skull, skinHead, neck, [0, 0.145, 0.008], [0.92, 1.1, 1]);
  const cap = new THREE.SphereGeometry(0.112, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.58);
  mesh(cap, hair, neck, [0, 0.158, -0.008], [0.94, 1.08, 1.02]).rotation.x = -0.32;
  mesh(new THREE.SphereGeometry(0.016, 12, 10), skinHead, neck, [0, 0.135, 0.108], [1, 1.2, 1]);
  const eye = new THREE.SphereGeometry(0.0105, 10, 8);
  mesh(eye, hair, neck, [0.036, 0.158, 0.097]);
  mesh(eye, hair, neck, [-0.036, 0.158, 0.097]);

  // Гар
  const arm = (side: 1 | -1) => {
    const sh = joint(chest, side * 0.185, 0.215);
    mesh(limbGeo(0.13, 0.054, 0.048), sleeve, sh);
    mesh(limbGeo(0.275, 0.044, 0.04, 0.005), skinArm, sh);
    const el = joint(sh, 0, -0.29);
    mesh(limbGeo(0.25, 0.04, 0.03, 0.006), skinArm, el);
    const wr = joint(el, 0, -0.27);
    mesh(limbGeo(0.055, 0.03, 0.026), skinArm, wr, [0, 0, 0], [1, 1, 0.62]);
    return { sh, el, wr };
  };
  const L = arm(1), R = arm(-1);

  // Хөл
  const leg = (side: 1 | -1) => {
    const hip = joint(root, side * 0.092, -0.03);
    mesh(limbGeo(0.17, 0.088, 0.078), shorts, hip);
    mesh(limbGeo(0.4, 0.074, 0.056, 0.008), skinLeg, hip);
    const kn = joint(hip, 0, -0.43);
    mesh(limbGeo(0.39, 0.054, 0.038, 0.012), skinLeg, kn);
    const an = joint(kn, 0, -0.42);
    const foot = mesh(limbGeo(0.16, 0.04, 0.042), shoe, an, [0, -0.032, -0.045], [1, 0.72, 1]);
    foot.rotation.x = -Math.PI / 2;
    return { hip, kn, an };
  };
  const LL = leg(1), RL = leg(-1);

  const joints: Rig['joints'] = {
    root, spine, chest, neck,
    shL: L.sh, shR: R.sh, elL: L.el, elR: R.el, wrL: L.wr, wrR: R.wr,
    hipL: LL.hip, hipR: RL.hip, knL: LL.kn, knR: RL.kn, anL: LL.an, anR: RL.an,
  };

  // Газарт хүрч болох цэгүүд: [үе, байрлал, радиус]
  const contacts = ([
    [LL.an, [0, -0.06, -0.05], 0.012], [RL.an, [0, -0.06, -0.05], 0.012], [LL.an, [0, -0.06, 0.15], 0.012], [RL.an, [0, -0.06, 0.15], 0.012],
    [LL.kn, [0, 0, 0], 0.055], [RL.kn, [0, 0, 0], 0.055], [L.wr, [0, -0.05, 0], 0.02], [R.wr, [0, -0.05, 0], 0.02], [L.el, [0, 0, 0], 0.04], [R.el, [0, 0, 0], 0.04],
  ] as const).map(([g, p, r]) => ({ g, p: new THREE.Vector3(...p), r }));
  const ankles = [LL.an, RL.an];

  const shBase = { L: L.sh.position.clone(), R: R.sh.position.clone() };
  const v = new THREE.Vector3();

  function apply(p: Pose, regions: Region[] | undefined, time: number) {
    for (const k of Object.keys(joints) as Joint[]) joints[k].rotation.set(rad(p[k][0]), rad(p[k][1]), rad(p[k][2]));
    for (const [g, b] of [[L.sh, shBase.L], [R.sh, shBase.R]] as const) g.position.set(b.x, b.y + 0.055 * p.shrug, b.z + 0.04 * p.fwd);
    ribs.scale.set(1.16 * (1 + 0.035 * p.breath), 1 + 0.02 * p.breath, 0.74 * (1 + 0.11 * p.breath));

    // Хөлийг нэг цэгт байлгаж, хамгийн доод цэгийг шалан дээр тавина
    root.position.set(0, 0, 0);
    root.updateMatrixWorld(true);
    let cx = 0, cz = 0;
    for (const a of ankles) { a.getWorldPosition(v); cx += v.x / 2; cz += v.z / 2; }
    let low = Infinity;
    for (const c of contacts) low = Math.min(low, v.copy(c.p).applyMatrix4(c.g.matrixWorld).y - c.r);
    root.position.set(-cx, -low + p.lift, -cz + p.dz);

    const pulse = p.glow * (0.34 + 0.1 * Math.sin(time * 6));
    for (const [region, list] of mats) for (const m of list) m.emissiveIntensity = regions?.includes(region) ? pulse : 0;
  }

  return { root, joints, apply };
}

/* ---------- Амьтан: хүүхэлдэй шиг (chibi) том толгой, жижиг дугуй бие, богино мөч ----------
   Муур: саарал судалтай, цагаан хоншоор, цээж, сарвуу, улаан хүзүүвч, алтан хонх. Туулай: цагаан, урт ягаан чих.
   Ижил үе мөчтэй тул бүх хөдөлгөөн ажиллана. Жижиг загварыг бүхэлд нь томруулж (SCALE) хүний өндөртэй ойртуулна. */
const ANIMAL = {
  cat: { fur: '#A6A6AD', stripe: '#6B6B73', white: '#FAF7F2', inner: '#F4A9B6', nose: '#F08A9C', eye: '#C98A2E' },
  rabbit: { fur: '#FBF6F2', stripe: '#EFE6E0', white: '#FFFFFF', inner: '#F7A8B8', nose: '#F08A9C', eye: '#3A2A22' },
} as const;
const SCALE = 1.5;

function buildAnimal(kind: 'cat' | 'rabbit'): Rig {
  const c = ANIMAL[kind], cat = kind === 'cat';
  const mats = new Map<Region, THREE.MeshStandardMaterial[]>();
  const mat = (color: string, region: Region, rough = 0.9) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, emissive: GLOW, emissiveIntensity: 0 });
    mats.set(region, [...(mats.get(region) ?? []), m]);
    return m;
  };
  const fur = { legs: mat(c.fur, 'legs'), arms: mat(c.fur, 'arms'), head: mat(c.fur, 'head'), core: mat(c.fur, 'core'), sh: mat(c.fur, 'shoulders') };
  const white = { legs: mat(c.white, 'legs'), arms: mat(c.white, 'arms'), head: mat(c.white, 'head'), core: mat(c.white, 'core') };
  const stripe = { legs: mat(c.stripe, 'legs'), arms: mat(c.stripe, 'arms'), head: mat(c.stripe, 'head'), core: mat(c.stripe, 'core') };
  const plain = (color: string, rough = 0.5, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
  const inner = plain(c.inner, 0.9), nose = plain(c.nose, 0.4), pupil = plain('#16110F', 0.15), iris = plain(c.eye, 0.25), shine = plain('#FFFFFF', 0.1);
  const blush = plain('#FF9DB0', 0.9), mouth = plain('#7A2B3A', 0.6), tongue = plain('#F47C8E', 0.6), collar = plain('#D7263D', 0.5), gold = plain('#E8B33A', 0.25, 0.6), pad = plain('#F59FB0', 0.8);

  const mesh = (geo: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, pos?: [number, number, number], scale?: [number, number, number], shadow = true) => {
    const o = new THREE.Mesh(geo, m);
    o.castShadow = shadow;
    if (pos) o.position.set(...pos);
    if (scale) o.scale.set(...scale);
    parent.add(o);
    return o;
  };
  const joint = (parent: THREE.Object3D, x: number, y: number, z = 0) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  const ball = (r: number, w = 32, h = 24) => new THREE.SphereGeometry(r, w, h);
  // Судал: биеийг тойрсон нимгэн тууз
  const band = (parent: THREE.Object3D, m: THREE.Material, r: number, y: number, sx = 1, sz = 1, arc = Math.PI * 2, rotY = 0) => {
    const o = mesh(new THREE.TorusGeometry(r, r * 0.09, 6, 28, arc), m, parent, [0, y, 0], [sx, 1, sz], false);
    o.rotation.set(Math.PI / 2, 0, rotY);
    return o;
  };

  const root = new THREE.Group();
  root.scale.setScalar(cat ? SCALE : SCALE * 0.9); // туулай урт чихтэй тул арай жижиг
  // Бөгс, гэдэс: дугуй
  mesh(ball(0.17), fur.core, root, [0, 0.02, -0.01], [1.05, 0.9, 0.98]);
  mesh(ball(0.12), white.core, root, [0, 0.03, 0.08], [1.05, 0.95, 0.6], false);
  const spine = joint(root, 0, 0.06);
  const chest = joint(spine, 0, 0.1);
  const ribs = mesh(ball(0.155), fur.core, chest, [0, 0.06, 0], [1, 1.05, 0.95]);
  // Сэвсгэр цагаан цээж
  mesh(ball(0.11), white.core, chest, [0, 0.06, 0.085], [1.05, 1.15, 0.55], false);
  if (cat) {
    // Нуруун дээрх судал (урд талын цагаан цээжийг хөндөхгүй)
    for (const y of [0.0, 0.07, 0.14]) mesh(ball(0.1), stripe.core, chest, [0, y, -0.11], [1.35, 0.22, 0.55], false);
    for (const y of [0.0, 0.06]) mesh(ball(0.1), stripe.core, root, [0, y, -0.12], [1.3, 0.22, 0.55], false);
    // Улаан хүзүүвч, алтан хонх
    band(chest, collar, 0.115, 0.18, 1, 0.95).scale.set(1, 1, 0.95);
    mesh(ball(0.032), gold, chest, [0, 0.145, 0.115]);
    mesh(new THREE.TorusGeometry(0.012, 0.004, 6, 12), gold, chest, [0, 0.178, 0.112], undefined, false);
  }

  // Том толгой
  const neck = joint(chest, 0, 0.17);
  const head = joint(neck, 0, 0.2);
  mesh(ball(0.26, 40, 30), fur.head, head, [0, 0, 0], [1.1, 0.95, 0.98]);
  // Цагаан хоншоор, хацар (муурынх том цагаан толбо)
  mesh(ball(0.15), white.head, head, [0, -0.08, 0.13], cat ? [1.35, 0.85, 0.8] : [1.2, 0.8, 0.75], false);
  if (cat) {
    for (const x of [-0.05, 0, 0.05]) mesh(ball(0.05), stripe.head, head, [x, 0.17, 0.15], [0.35, 1.3, 0.4], false);
    for (const y of [0.08, 0.16]) mesh(ball(0.14), stripe.head, head, [0, y, -0.17], [1.35, 0.18, 0.55], false);
  }
  for (const s of [1, -1]) {
    // Том гялалзсан нүд
    const eye = joint(head, s * 0.105, 0.01, 0.228);
    mesh(ball(0.058), cat ? iris : pupil, eye, [0, 0, 0], [1, 1.15, 0.6], false);
    if (cat) mesh(ball(0.045), pupil, eye, [0, 0, 0.012], [0.95, 1.12, 0.6], false);
    mesh(ball(0.019), shine, eye, [s * -0.012, 0.024, 0.032], undefined, false);
    mesh(ball(0.009), shine, eye, [s * 0.016, -0.018, 0.034], undefined, false);
    eye.userData.blink = true;
    mesh(ball(0.04), blush, head, [s * 0.17, -0.07, 0.18], [1.1, 0.6, 0.35], false);
  }
  mesh(ball(0.026), nose, head, [0, -0.045, 0.26], [1.3, 0.85, 0.8], false);
  // Инээмсэглэсэн ам: нээлттэй, хэлтэй
  mesh(ball(0.036), mouth, head, [0, -0.11, 0.238], [1.15, 0.55, 0.4], false);
  mesh(ball(0.022), tongue, head, [0, -0.122, 0.25], [1.1, 0.5, 0.4], false);

  if (cat) {
    // Гурвалжин чих, ягаан дотор тал, сахал
    for (const s of [1, -1]) {
      const ear = joint(head, s * 0.15, 0.17, -0.02);
      ear.rotation.set(-0.12, 0, -s * 0.38);
      mesh(new THREE.ConeGeometry(0.1, 0.17, 24), fur.head, ear, [0, 0.07, 0], [1, 1, 0.6]);
      mesh(new THREE.ConeGeometry(0.065, 0.12, 24), inner, ear, [0, 0.06, 0.03], [1, 1, 0.35], false);
      for (const k of [-1, 0, 1]) {
        const w = mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.17, 4), plain('#3A3A40'), head, [s * 0.2, -0.07 + k * 0.022, 0.17], undefined, false);
        w.rotation.z = Math.PI / 2 + s * k * 0.14;
      }
    }
  } else {
    // Урт чих, ягаан дотор тал
    for (const s of [1, -1]) {
      const ear = joint(head, s * 0.075, 0.2, -0.03);
      ear.rotation.set(-0.15, 0, -s * 0.16);
      mesh(limbGeo(0.32, 0.07, 0.045), fur.head, ear, [0, 0, 0], [1, 1, 0.55]).rotation.x = Math.PI;
      mesh(limbGeo(0.27, 0.045, 0.028), inner, ear, [0, 0.03, 0.022], [1, 1, 0.3], false).rotation.x = Math.PI;
    }
  }

  // Богино гар, цагаан сарвуу
  const arm = (side: 1 | -1) => {
    const sh = joint(chest, side * 0.135, 0.11);
    mesh(ball(0.065), fur.sh, sh);
    mesh(limbGeo(0.13, 0.064, 0.058), fur.arms, sh);
    if (cat) band(sh, stripe.arms, 0.062, -0.08);
    const el = joint(sh, 0, -0.14);
    mesh(ball(0.058), fur.arms, el);
    mesh(limbGeo(0.12, 0.058, 0.055), fur.arms, el);
    const wr = joint(el, 0, -0.13);
    mesh(ball(0.068), cat ? white.arms : fur.arms, wr, [0, -0.02, 0], [1, 0.9, 0.9]);
    return { sh, el, wr };
  };
  const L = arm(1), R = arm(-1);

  // Богино бүдүүн хөл, том сарвуу (доор нь ягаан дэвсгэр)
  const leg = (side: 1 | -1) => {
    const hip = joint(root, side * 0.09, -0.06);
    mesh(limbGeo(0.13, 0.095, 0.075), fur.legs, hip);
    if (cat) band(hip, stripe.legs, 0.085, -0.07);
    const kn = joint(hip, 0, -0.14);
    mesh(ball(0.072), fur.legs, kn);
    mesh(limbGeo(0.11, 0.07, 0.062), fur.legs, kn);
    const an = joint(kn, 0, -0.12);
    mesh(ball(0.08), cat ? white.legs : fur.legs, an, [0, -0.02, 0.035], [1, 0.65, 1.45]);
    mesh(ball(0.03), pad, an, [0, -0.07, 0.04], [1.2, 0.3, 1.1], false);
    return { hip, kn, an };
  };
  const LL = leg(1), RL = leg(-1);

  // Сүүл
  const tail = joint(root, 0, -0.02, -0.16);
  if (cat) {
    const curve = new THREE.CatmullRomCurve3([[0, 0, 0], [0.02, 0.02, -0.12], [0.08, 0.1, -0.18], [0.14, 0.22, -0.14]].map(p => new THREE.Vector3(...p)));
    mesh(new THREE.TubeGeometry(curve, 24, 0.035, 12), fur.core, tail);
    for (const u of [0.35, 0.6, 0.85]) {
      const p = curve.getPoint(u), t = curve.getTangent(u);
      const o = mesh(new THREE.TorusGeometry(0.036, 0.008, 6, 16), stripe.core, tail, [p.x, p.y, p.z], undefined, false);
      o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), t);
    }
    mesh(ball(0.038), stripe.core, tail, [0.14, 0.22, -0.14]);
  } else mesh(ball(0.085), white.core, tail, [0, 0.03, -0.01]);

  const joints: Rig['joints'] = {
    root, spine, chest, neck,
    shL: L.sh, shR: R.sh, elL: L.el, elR: R.el, wrL: L.wr, wrR: R.wr,
    hipL: LL.hip, hipR: RL.hip, knL: LL.kn, knR: RL.kn, anL: LL.an, anR: RL.an,
  };
  const contacts = ([
    [LL.an, [0, -0.072, -0.07], 0.002], [RL.an, [0, -0.072, -0.07], 0.002], [LL.an, [0, -0.072, 0.12], 0.002], [RL.an, [0, -0.072, 0.12], 0.002],
    [LL.kn, [0, 0, 0], 0.072], [RL.kn, [0, 0, 0], 0.072], [L.wr, [0, -0.08, 0], 0.005], [R.wr, [0, -0.08, 0], 0.005], [L.el, [0, 0, 0], 0.058], [R.el, [0, 0, 0], 0.058],
    [root, [0, -0.12, 0], 0.03],
  ] as const).map(([g, p, r]) => ({ g, p: new THREE.Vector3(...p), r: r * root.scale.x }));
  const ankles = [LL.an, RL.an];
  const shBase = { L: L.sh.position.clone(), R: R.sh.position.clone() };
  const eyes: THREE.Object3D[] = [];
  head.traverse(o => { if (o.userData.blink && o instanceof THREE.Group) eyes.push(o); });
  const v = new THREE.Vector3();

  function apply(p: Pose, regions: Region[] | undefined, time: number) {
    for (const k of Object.keys(joints) as Joint[]) joints[k].rotation.set(rad(p[k][0]), rad(p[k][1]), rad(p[k][2]));
    for (const [g, b] of [[L.sh, shBase.L], [R.sh, shBase.R]] as const) g.position.set(b.x, b.y + 0.03 * p.shrug, b.z + 0.025 * p.fwd);
    ribs.scale.set(1 + 0.05 * p.breath, 1.05 * (1 + 0.03 * p.breath), 0.95 * (1 + 0.1 * p.breath));
    // Амьд мэт: сүүл эргэлдэнэ, толгой үл ялиг хазайна, 4 секунд тутам нүдээ анивчина
    tail.rotation.set(cat ? 0.15 * Math.sin(time * 1.3) : 0, cat ? 0.5 * Math.sin(time * 2.1) : 0, cat ? 0 : 0.25 * Math.sin(time * 5));
    head.rotation.z = 0.06 * Math.sin(time * 0.9);
    const blink = (time % 4) < 0.12 ? 0.12 : 1;
    for (const e of eyes) e.scale.y = blink;

    root.position.set(0, 0, 0);
    root.updateMatrixWorld(true);
    let cx = 0, cz = 0;
    for (const a of ankles) { a.getWorldPosition(v); cx += v.x / 2; cz += v.z / 2; }
    let low = Infinity;
    for (const ct of contacts) low = Math.min(low, v.copy(ct.p).applyMatrix4(ct.g.matrixWorld).y - ct.r);
    root.position.set(-cx, -low + p.lift, -cz + p.dz);

    const pulse = p.glow * (0.34 + 0.1 * Math.sin(time * 6));
    for (const [region, list] of mats) for (const m of list) m.emissiveIntensity = regions?.includes(region) ? pulse : 0;
  }

  return { root, joints, apply };
}
