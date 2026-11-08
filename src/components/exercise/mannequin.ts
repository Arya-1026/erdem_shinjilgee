import * as THREE from 'three';
import { rad, type Joint, type Pose, type Region } from '@/lib/exercise-moves';

/* Дасгал үзүүлэх 3D дүр (хүн, муур, туулай): үе мөч бүр нь Group, биеийн хэсгүүдийг хэлбэрт оруулсан mesh.
   Гадны модель файл шаардахгүй. Гурвуулаа ижил араг ястай тул бүх хөдөлгөөн (ANIMS) адилхан ажиллана. */
import type { Character } from './character';
import { buildPet } from './pet-rig';

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

export function buildMannequin(kind: Character = 'human', lite = false): Rig {
  if (kind !== 'human') return buildPet(kind, lite);
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
