import * as THREE from 'three';
import { rad, type Joint, type Pose, type Region } from '@/lib/exercise-moves';
import type { Rig } from './mannequin';

/* ---------- Дасгал хийдэг Мяугаа, Бөжгөө ----------
   public/pets/myaugaa.html, bujgoo.html дахь хэрэглэгчийн өөрийн загварыг ЯГ хэвээр нь (хэмжээ, өнгө, үс, нүд,
   хөмсөг, хацар, ам, чих, сахал, сүүл, Бөжгөөгийн сарны зүүлт, чихэвч) "Баяртай" царайгаар нь буулгав.
   Өөрчлөлт: дасгалын хөдөлгөөнд зориулж их бие нуруу/цээж гэсэн хоёр үетэй болсон. Загварт тохой, өвдөг байхгүй
   тул гар мөрнөөсөө, хөл гуянаасаа л эргэнэ. */

type Kind = 'cat' | 'rabbit';
/** Загварын нэгжийг тайзны хүний өндөртэй ойртуулна */
const SCALE = 0.8;

const SPECIES = {
  cat: {
    TAN: '#EC8A3A', CURL: '#F09A4C', CREAM: '#FCEEDC', BROWN: '#8A4A1C', PAW: '#FBEBD8', STRIPE: '#C45E1C', PAD: '#F4A6AE',
    NOSE: '#F29AA2', EAR_IN: '#F4AAB0', BL: 0.07, BD: 56,
  },
  rabbit: {
    TAN: '#E2C29E', CURL: '#EBD0B0', CREAM: '#F6E6D2', BROWN: '#9A7352', PAW: '#F4E2CC', STRIPE: '', PAD: '#F2A3A0',
    NOSE: '#F09AA0', EAR_IN: '#F2B2AE', BL: 0.075, BD: 48,
  },
} as const;
// Анхны загварын "Баяртай" царай
const FACE = { lid: 0, low: 0, brow: 0.15, by: 0.03, smile: 1, open: 0.75, ear: -0.15 };

/* ---------- Үс: бүрхүүлийн давхаргууд (анхны shader, дээр нь дасгалын бүсийг тодруулах гэрэл) ---------- */
const furVS = `
uniform float uLayer; uniform vec3 uGrav;
attribute vec3 aTint; attribute float aLen; attribute float aDens;
varying vec3 vP; varying vec3 vN; varying vec3 vTint; varying vec3 vView; varying float vDens;
void main(){
  vec3 p=position+normal*aLen*.95*uLayer;
  vec4 wp=modelMatrix*vec4(p,1.);
  wp.xyz+=uGrav*uLayer*uLayer*aLen;
  vP=position; vDens=aDens; vTint=aTint;
  vN=normalize(normalMatrix*normal);
  vec4 mv=viewMatrix*wp; vView=-mv.xyz;
  gl_Position=projectionMatrix*mv;
}`;
const furFS = `
precision highp float;
uniform float uLayer; uniform float uGlow;
varying vec3 vP; varying vec3 vN; varying vec3 vTint; varying vec3 vView; varying float vDens;
float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
void main(){
  float h=uLayer;
  vec3 q=vP*vDens*1.8; vec3 c=floor(q); vec3 f=fract(q)-.5;
  vec3 off=vec3(h3(c+1.3),h3(c+7.1),h3(c+3.7))-.5;
  float r=h3(c); float d=length(f-off*.45);
  if(h>0.){
    float L=.62+.38*r;
    if(h>L) discard;
    if(d>.6*(1.-h/L)+.06) discard;
  }
  vec3 N=normalize(vN); vec3 V=normalize(vView);
  vec3 Ld=normalize(vec3(.45,.8,.55));
  float diff=dot(N,Ld)*.5+.5;
  float ao=mix(.62,1.,pow(h,.6));
  float rim=pow(1.-max(dot(N,V),0.),2.2)*.38;
  vec3 tint=vTint*(.92+.16*r);
  vec3 cc=tint*(.5+.62*diff)*ao*mix(.97,1.08,h)+rim*vec3(1.,.9,.78);
  cc+=vec3(1.,.48,.27)*uGlow;
  gl_FragColor=vec4(cc,1.);
}`;

type TF = (x: number, y: number, z: number, c: THREE.Color) => THREE.Color;
type Part = { g: THREE.BufferGeometry; m?: THREE.Matrix4 | null; tint: string; len: number; dens: number; tf?: TF };

const PI = Math.PI;
const col = (h: string) => new THREE.Color(h);
const ell = (r: number, s?: [number, number, number] | null, seg = 40) => { const g = new THREE.SphereGeometry(r, seg, Math.floor(seg * 0.6)); if (s) g.scale(...s); return g; };
const M = (px: number, py: number, pz: number, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)).setPosition(px, py, pz);
const std = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: col(c), roughness: 0.55, ...o });
const cnv = (w: number, h: number) => Object.assign(document.createElement('canvas'), { width: w, height: h });
const tex = (c: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };

function merge(parts: Part[]) {
  const geos = parts.map(p => { const g = p.g.index ? p.g.toNonIndexed() : p.g.clone(); if (p.m) g.applyMatrix4(p.m); return g; });
  const n = geos.reduce((s, g) => s + g.attributes.position.count, 0);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), tin = new Float32Array(n * 3), len = new Float32Array(n), den = new Float32Array(n);
  let o = 0;
  geos.forEach((g, i) => {
    const p = parts[i], c = col(p.tint), cnt = g.attributes.position.count, pa = g.attributes.position.array as Float32Array;
    pos.set(pa, o * 3); nor.set(g.attributes.normal.array as Float32Array, o * 3);
    for (let k = 0; k < cnt; k++) {
      const cc = p.tf ? p.tf(pa[k * 3], pa[k * 3 + 1], pa[k * 3 + 2], c) : c;
      tin[(o + k) * 3] = cc.r; tin[(o + k) * 3 + 1] = cc.g; tin[(o + k) * 3 + 2] = cc.b; len[o + k] = p.len; den[o + k] = p.dens;
    }
    o += cnt;
    g.dispose();
  });
  parts.forEach(p => p.g.dispose());
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('aTint', new THREE.BufferAttribute(tin, 3)); g.setAttribute('aLen', new THREE.BufferAttribute(len, 1)); g.setAttribute('aDens', new THREE.BufferAttribute(den, 1));
  g.computeBoundingSphere();
  return g;
}

export function buildPet(kind: Kind, lite: boolean): Rig {
  const S = SPECIES[kind], cat = kind === 'cat';
  const { TAN, CURL, CREAM, BROWN, PAW, BL, BD } = S;
  const C_CREAM = col(CREAM), C_STRIPE = cat ? col(S.STRIPE) : null;
  // Анхны загвар утсан дээр 12, бусад үед 32 давхарга
  const LAYERS = lite ? 12 : 32;
  const grav = { value: new THREE.Vector3(0, -0.55, 0) };
  const glow: Record<Region, { value: number }> = { legs: { value: 0 }, arms: { value: 0 }, core: { value: 0 }, shoulders: { value: 0 }, head: { value: 0 } };
  const fur = (parts: Part[], region: Region) => {
    const g = merge(parts), grp = new THREE.Group();
    for (let i = 0; i < LAYERS; i++) {
      const m = new THREE.ShaderMaterial({ uniforms: { uLayer: { value: i / (LAYERS - 1) }, uGrav: grav, uGlow: glow[region] }, vertexShader: furVS, fragmentShader: furFS });
      const mesh = new THREE.Mesh(g, m);
      mesh.frustumCulled = false;
      if (i === 0) mesh.castShadow = true;
      grp.add(mesh);
    }
    return grp;
  };
  const group = (parent: THREE.Object3D, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
  const mesh = (parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m; };

  /* Үе: root (загварын "pose") → spine (бөгс) → chest → neck (headPivot) → head; chest → мөр; root → гуя.
     inSpine, inChest групп дотор анхны (pose) координат хүчинтэй. */
  const root = new THREE.Group();
  root.scale.setScalar(SCALE);
  const SP_Y = 0.3, CH_Y = 0.66;
  const spine = group(root, 0, SP_Y, 0);
  const chest = group(spine, 0, CH_Y - SP_Y, 0);
  const inChest = group(chest, 0, -CH_Y, 0);
  const inSpine = group(spine, 0, -SP_Y, 0);

  // Бие (амьсгалахад хөөрнө)
  const bodyTF: TF = (x, y, z, c) => (z > 0.2 && Math.abs(x) < 0.3 && y < 1.1) ? C_CREAM : (C_STRIPE && z < 0 && Math.sin(y * 22 + Math.abs(x) * 3) > 0.45 ? C_STRIPE : c);
  const body = group(chest);
  const bodyIn = group(body, 0, -CH_Y, 0);
  bodyIn.add(fur([{ g: ell(1, [0.52, 0.6, 0.47]), m: M(0, 0.66, 0), tint: TAN, len: 0.012, dens: BD, tf: bodyTF }], 'core'));

  // Хөл: гуя дээр эргэнэ
  const legTF: TF | undefined = C_STRIPE ? (x, y, z, c) => (Math.sin(z * 26) > 0.6 ? C_STRIPE : c) : undefined;
  const padMat = std(S.PAD, { roughness: 0.7 });
  const legs = ([1, -1] as const).map(s => {
    const hp = group(root, s * 0.22, 0.24, 0.12);
    const lp: Part[] = [{ g: ell(1, [0.15, 0.15, 0.16]), m: M(0, -0.05, 0), tint: TAN, len: 0.03, dens: BD, tf: legTF }];
    lp.push({ g: ell(1, [0.15, 0.1, 0.2]), m: M(0, -0.26, 0.08), tint: PAW, len: 0.04, dens: 70 });
    [-1, 0, 1].forEach(k => lp.push({ g: ell(0.055, null, 14), m: M(k * 0.065, -0.28, 0.24), tint: PAW, len: 0.03, dens: 80 }));
    hp.add(fur(lp, 'legs'));
    mesh(hp, ell(1, [0.08, 0.02, 0.08], 16), padMat, 0, -0.37, 0.07);
    [-1, 0, 1].forEach(k => mesh(hp, ell(1, [0.03, 0.015, 0.03], 10), padMat, k * 0.065, -0.36, 0.22));
    return hp;
  });

  // Гар: мөрөн дээр эргэнэ
  const armTF: TF | undefined = C_STRIPE ? (x, y, z, c) => (Math.sin(y * 28) > 0.6 ? C_STRIPE : c) : undefined;
  const arms = ([1, -1] as const).map(s => {
    const p = group(inChest, s * 0.36, 1.02, 0.2);
    p.add(fur([
      { g: ell(1, [0.125, 0.25, 0.13]), m: M(0, -0.18, 0.04), tint: TAN, len: BL, dens: BD, tf: armTF },
      { g: ell(1, [0.125, 0.105, 0.125]), m: M(0, -0.4, 0.06), tint: PAW, len: 0.04, dens: 70 },
    ], 'arms'));
    return p;
  });

  // Сүүл
  const tail = group(inSpine, 0, 0.28, cat ? -0.42 : -0.44);
  if (cat) {
    const stripe = C_STRIPE!;
    tail.add(fur([[0, 0, 0], [0, 0.02, -0.15], [0, 0.12, -0.28], [0, 0.28, -0.35], [0, 0.45, -0.33], [0, 0.6, -0.26], [0, 0.71, -0.16], [0, 0.78, -0.06]]
      .map((p, i): Part => ({ g: ell(0.115 - i * 0.004, null, 22), m: M(p[0], p[1], p[2]), tint: TAN, len: 0.09, dens: 34, tf: (x, y, z, c) => (Math.sin((y - z) * 14) > 0.45 ? stripe : c) })), 'core'));
  } else {
    tail.add(fur([[0, 0, 0, 0.14], [0.06, 0.05, -0.04, 0.1], [-0.06, 0.05, -0.04, 0.1], [0, -0.04, -0.07, 0.1]]
      .map((p): Part => ({ g: ell(p[3], null, 18), m: M(p[0], p[1], p[2]), tint: CREAM, len: 0.13, dens: 22 })), 'core'));
  }

  // Толгой
  const neck = group(inChest, 0, 1.08, 0.02);
  const head = group(neck, 0, 0.52, 0);
  const headParts: Part[] = cat ? [
    {
      g: ell(0.62, [1.04, 0.92, 0.95], 48), tint: TAN, len: 0.06, dens: 62, tf: (x, y, z, c) => {
        if (y < -0.02 && z > 0.22) return C_CREAM;
        if (z > 0.1 && y > 0.22 && Math.sin(x * 30) > 0.4) return C_STRIPE!;
        if (Math.abs(x) > 0.45 && y > -0.05 && Math.sin(y * 26) > 0.55) return C_STRIPE!;
        return c;
      },
    },
    { g: ell(1, [0.25, 0.17, 0.18]), m: M(0, -0.2, 0.5), tint: CREAM, len: 0.03, dens: 96 },
  ] : [
    { g: ell(0.62, [1, 0.94, 0.96], 48), tint: TAN, len: 0.06, dens: 56, tf: (x, y, z, c) => (y < -0.05 && z > 0.25 ? C_CREAM : c) },
    { g: ell(1, [0.24, 0.16, 0.17]), m: M(0, -0.2, 0.5), tint: CREAM, len: 0.03, dens: 90 },
  ];
  if (cat) {
    // Хацрын сэвсгэр үс, оройн буржгар
    [[0.6, -0.14, 0.12], [-0.6, -0.14, 0.12], [0.64, -0.02, -0.02], [-0.64, -0.02, -0.02], [0.5, -0.3, 0.18], [-0.5, -0.3, 0.18]]
      .forEach(p => headParts.push({ g: ell(0.13, null, 18), m: M(p[0], p[1], p[2]), tint: p[1] < -0.1 ? CREAM : CURL, len: 0.11, dens: 26 }));
    [[0, 0.58, 0.12], [0.14, 0.56, 0.08], [-0.14, 0.56, 0.08], [0.05, 0.6, -0.06], [-0.06, 0.6, -0.06]]
      .forEach(p => headParts.push({ g: ell(0.1, null, 18), m: M(p[0], p[1], p[2]), tint: CURL, len: 0.11, dens: 26 }));
  } else {
    [[0, 0.58, 0.12], [0.13, 0.56, 0.06], [-0.13, 0.56, 0.06]]
      .forEach(p => headParts.push({ g: ell(0.12, null, 18), m: M(p[0], p[1], p[2]), tint: CURL, len: 0.1, dens: 26 }));
  }
  head.add(fur(headParts, 'head'));

  // Нүд
  const ec = cnv(512, 256), g2 = ec.getContext('2d')!;
  g2.fillStyle = '#FBF4EA'; g2.fillRect(0, 0, 512, 256);
  const gr = g2.createRadialGradient(128, 120, 6, 128, 128, 70);
  gr.addColorStop(0, '#4A2A16'); gr.addColorStop(0.7, '#2B160B'); gr.addColorStop(1, '#140904');
  g2.fillStyle = gr; g2.beginPath(); g2.arc(128, 128, 72, 0, PI * 2); g2.fill();
  g2.fillStyle = '#070302'; g2.beginPath(); g2.arc(128, 130, 40, 0, PI * 2); g2.fill();
  const eyeMat = new THREE.MeshStandardMaterial({ map: tex(ec), roughness: 0.08, metalness: 0 });
  const lidMat = std(TAN, { roughness: 0.8 });
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const browMat = std(BROWN, { roughness: 0.7 });
  const eyes = ([1, -1] as const).map(s => {
    const g = group(head, s * 0.26, 0.045, 0.55);
    mesh(g, new THREE.SphereGeometry(0.155, 40, 24), eyeMat).rotation.y = s * 0.12;
    const up = mesh(g, new THREE.SphereGeometry(0.162, 32, 12, 0, PI * 2, 0, PI / 2), lidMat);
    const lo = mesh(g, new THREE.SphereGeometry(0.161, 32, 12, 0, PI * 2, PI / 2, PI / 2), lidMat);
    lo.rotation.x = 1.55 - FACE.low * 1.25;
    const hl = group(g);
    [[-0.36, 0.42, 0.83, 0.04], [0.32, -0.3, 0.9, 0.02]].forEach(d => {
      const v = new THREE.Vector3(d[0], d[1], d[2]).normalize();
      const c = mesh(hl, new THREE.CircleGeometry(d[3], 20), hlMat);
      c.position.copy(v.clone().multiplyScalar(0.1575));
      c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), v);
    });
    const brow = mesh(head, ell(1, [0.1, 0.024, 0.032], 20), browMat, s * 0.26, 0.255 + FACE.by + 0.01, 0.565);
    brow.rotation.set(0, s * 0.38, -s * FACE.brow * 0.75);
    return { up, hl };
  });

  // Хацар
  const bc = cnv(128, 128), gb = bc.getContext('2d')!, bg = gb.createRadialGradient(64, 64, 4, 64, 64, 62);
  bg.addColorStop(0, 'rgba(255,120,130,.75)'); bg.addColorStop(1, 'rgba(255,120,130,0)');
  gb.fillStyle = bg; gb.fillRect(0, 0, 128, 128);
  const blushMat = new THREE.MeshBasicMaterial({ map: tex(bc), transparent: true, depthWrite: false });
  for (const s of [1, -1]) {
    const v = new THREE.Vector3(s * 0.62, -0.22, 0.76).normalize().multiplyScalar(0.665);
    const m = mesh(head, new THREE.PlaneGeometry(0.3, 0.22), blushMat);
    m.position.copy(v); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), v.clone().normalize()); m.renderOrder = 5;
  }

  // Хамар, ам
  const darkMat = std('#3A2215', { roughness: 0.5 });
  if (cat) {
    mesh(head, ell(1, [0.065, 0.042, 0.035], 20), std(S.NOSE, { roughness: 0.45 }), 0, -0.115, 0.69);
    mesh(head, new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0, -0.15, 0.69), new THREE.Vector3(0, -0.22, 0.675)), 4, 0.009, 6), darkMat);
  } else {
    mesh(head, ell(1, [0.05, 0.034, 0.03], 18), std(S.NOSE, { roughness: 0.45 }), 0, -0.12, 0.665);
    const tm = std('#FFFDF7', { roughness: 0.3 });
    for (const s of [1, -1]) mesh(head, new THREE.BoxGeometry(0.04, 0.055, 0.016), tm, s * 0.022, -0.285, 0.655);
    mesh(head, new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(0, -0.15, 0.67), new THREE.Vector3(0, -0.23, 0.66)), 4, 0.008, 6), darkMat);
  }
  const mouth = cat ? group(head, 0, -0.235, 0.665) : group(head, 0, -0.24, 0.655);
  {
    const { smile, open } = FACE, w = 0.1;
    const pts = Array.from({ length: 9 }, (_, i) => { const x = -w + 2 * w * i / 8, t = x / w; return new THREE.Vector3(x, smile * 0.055 * t * t - smile * 0.012 + (open > 0.05 ? 0.006 : 0), -1.1 * x * x); });
    mesh(mouth, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.013, 6), darkMat);
    const cavity = mesh(mouth, ell(1, [0.085, 0.06, 0.03], 24), std('#7A2E2A', { roughness: 0.6 }), 0, -0.012 - 0.045 * open, -0.004);
    cavity.scale.set(0.6 + 0.6 * open, Math.max(0.01, open), 1);
    mesh(mouth, ell(1, [0.05, 0.025, 0.02], 16), std('#E98584'), 0, -0.018 - 0.06 * open, 0.012);
  }

  // Чих
  const ears = ([1, -1] as const).map(s => {
    if (cat) {
      const p = group(head, s * 0.38, 0.44, -0.02);
      const eg = new THREE.ConeGeometry(0.2, 0.36, 4, 6); eg.rotateY(PI / 4); eg.translate(0, 0.2, 0); eg.scale(1, 1, 0.45); eg.computeVertexNormals();
      p.add(fur([{ g: eg, tint: TAN, len: 0.03, dens: 85 }], 'head'));
      const ig = new THREE.ConeGeometry(0.12, 0.26, 4, 4); ig.rotateY(PI / 4); ig.translate(0, 0.16, 0); ig.scale(1, 1, 0.3);
      mesh(p, ig, std(S.EAR_IN, { roughness: 0.8 }), 0, 0, 0.06);
      return { s, p };
    }
    // Унжсан урт чих
    const p = group(head, s * 0.42, 0.44, -0.04);
    p.add(fur([{ g: ell(1, [0.16, 0.44, 0.08], 32), m: M(s * 0.1, -0.32, 0, 0, 0, s * 0.08), tint: TAN, len: 0.06, dens: 48 }], 'head'));
    mesh(p, ell(1, [0.085, 0.33, 0.03], 24), std(S.EAR_IN, { roughness: 0.8 }), s * 0.1, -0.32, 0.07).rotation.z = s * 0.08;
    return { s, p };
  });

  let pend: THREE.Group | null = null, led: THREE.Mesh | null = null;
  if (cat) {
    // Сахал
    const wm = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const s of [1, -1]) for (const dy of [-0.04, 0, 0.04]) {
      const c = new THREE.QuadraticBezierCurve3(new THREE.Vector3(s * 0.2, -0.18 + dy, 0.62), new THREE.Vector3(s * 0.42, -0.16 + dy * 1.6, 0.6), new THREE.Vector3(s * 0.62, -0.2 + dy * 2.6, 0.5));
      mesh(head, new THREE.TubeGeometry(c, 10, 0.006, 4), wm);
    }
  } else {
    // Сарны зүүлт
    const gold = std('#F0C55A', { roughness: 0.22, metalness: 0.8 }), pearl = std('#FFF7E8', { roughness: 0.2, metalness: 0.1 });
    mesh(inChest, new THREE.TorusGeometry(0.35, 0.012, 8, 64), gold, 0, 1.06, 0.1).rotation.x = PI / 2 + 0.5;
    const moon = new THREE.Shape(); moon.absarc(0, 0, 0.085, 0, PI * 2, false);
    const cut = new THREE.Path(); cut.absarc(0.04, 0.025, 0.072, 0, PI * 2, true); moon.holes.push(cut);
    pend = group(inChest, 0, 0.86, 0.58); pend.rotation.set(-0.2, 0, -0.35);
    mesh(pend, new THREE.ExtrudeGeometry(moon, { depth: 0.018, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 3, curveSegments: 32 }), gold);
    mesh(pend, new THREE.TorusGeometry(0.018, 0.006, 8, 16), gold, -0.02, 0.09, 0.01);
    mesh(pend, new THREE.SphereGeometry(0.018, 12, 8), pearl, 0.05, -0.02, 0.015);
    // Чихэвч
    const shell = std('#F7F4F8', { roughness: 0.35, metalness: 0.05 }), pink = std('#F6B8C8', { roughness: 0.5 }), pad = std('#FBE3EA', { roughness: 0.95 });
    const hp = group(head, 0, 0.04, -0.08); hp.rotation.x = -0.34;
    mesh(hp, new THREE.TorusGeometry(0.67, 0.05, 14, 56, PI), shell);
    mesh(hp, new THREE.TorusGeometry(0.625, 0.035, 10, 48, PI * 0.6), pink).rotation.z = PI * 0.2;
    for (const s of [1, -1]) {
      const cup = group(hp, s * 0.65, -0.02, 0);
      mesh(cup, new THREE.CylinderGeometry(0.21, 0.21, 0.13, 36), shell).rotation.z = PI / 2;
      mesh(cup, new THREE.CircleGeometry(0.15, 32), pink, s * 0.066).rotation.y = s * PI / 2;
      mesh(cup, new THREE.TorusGeometry(0.175, 0.06, 12, 32), pad, -s * 0.065).rotation.y = PI / 2;
      mesh(cup, new THREE.BoxGeometry(0.05, 0.18, 0.07), shell, 0, 0.2, 0);
      if (s > 0) led = mesh(cup, new THREE.SphereGeometry(0.018, 12, 8), new THREE.MeshBasicMaterial({ color: 0x3fa9ff }), s * 0.07, -0.1, 0.09);
    }
  }

  // Загварт тохой, өвдөг, бугуй, шагай байхгүй: дасгалын эдгээр үеийн өнцгийг хүлээж аваад хэрэглэхгүй
  const dummy = () => new THREE.Group();
  const joints: Rig['joints'] = {
    root, spine, chest, neck,
    shL: arms[0], shR: arms[1], elL: dummy(), elR: dummy(), wrL: dummy(), wrR: dummy(),
    hipL: legs[0], hipR: legs[1], knL: dummy(), knR: dummy(), anL: dummy(), anR: dummy(),
  };
  // Газарт хүрэх цэгүүд: сарвууны ул, хуруу, өвдөг орчим, гарын сарвуу, бөгс, толгой
  const pts: [THREE.Object3D, [number, number, number]][] = [
    ...legs.flatMap((h): [THREE.Object3D, [number, number, number]][] => [[h, [0, -0.38, 0]], [h, [0, -0.36, 0.26]], [h, [0, -0.15, 0.15]]]),
    ...arms.map((a): [THREE.Object3D, [number, number, number]] => [a, [0, -0.5, 0.06]]),
    [inSpine, [0, 0.1, 0]], [head, [0, 0.6, 0]], [head, [0, 0, 0.65]],
  ];
  const contacts = pts.map(([g, p]) => ({ g, p: new THREE.Vector3(...p) }));
  const belly = { p: new THREE.Vector3(0, 0.66, 0), r: 0.47 };
  const armBase = arms.map(a => a.position.clone());
  const v = new THREE.Vector3();

  function apply(p: Pose, regions: Region[] | undefined, time: number) {
    for (const k of Object.keys(joints) as Joint[]) joints[k].rotation.set(rad(p[k][0]), rad(p[k][1]), rad(p[k][2]));
    // Том толгойтой тул бөхийх, хэвтэх үед нүүр нь шал руу харахгүйн тулд толгойгоо өргөж урагш харна
    const bend = root.rotation.x + spine.rotation.x + chest.rotation.x;
    if (bend > 0.3) neck.rotation.x -= 0.75 * (bend - 0.3);
    arms.forEach((a, i) => a.position.set(armBase[i].x, armBase[i].y + 0.06 * p.shrug, armBase[i].z + 0.05 * p.fwd));
    body.scale.setScalar(1 + 0.03 * p.breath);
    // Анхны загварын амьд хөдөлгөөн: сүүл, чих, зүүлт, гэрэл, 4 секунд тутам анивчих
    tail.rotation.y = 0.3 * Math.sin(time * 1.3);
    ears.forEach(e => {
      if (cat) { e.p.rotation.z = -e.s * (0.22 + FACE.ear); e.p.rotation.x = -0.1 + FACE.ear * 0.25 + 0.06 * Math.sin(time * 1.3 + e.s); }
      else { e.p.rotation.z = e.s * (0.3 - FACE.ear * 0.25 + 0.35 + 0.12 * Math.sin(time * 6 + e.s)); e.p.rotation.x = 0.08 * Math.sin(time * 1.3 + e.s); }
    });
    if (pend) pend.rotation.z = -0.35 + 0.06 * Math.sin(time * 1.8);
    if (led) led.visible = Math.sin(time * 3) > -0.3;
    const lid = time % 4 < 0.14 ? 1 : FACE.lid;
    for (const e of eyes) { e.up.rotation.x = -1.55 + lid * 2.95; e.hl.visible = lid < 0.62; }

    root.position.set(0, 0, 0);
    root.updateMatrixWorld(true);
    let cx = 0, cz = 0;
    for (const l of legs) { v.set(0, -0.3, 0.1).applyMatrix4(l.matrixWorld); cx += v.x / 2; cz += v.z / 2; }
    let low = Infinity;
    for (const c of contacts) low = Math.min(low, v.copy(c.p).applyMatrix4(c.g.matrixWorld).y);
    // Хэвтэх, мөлхөх үед бөөрөнхий бие газарт хүрнэ
    low = Math.min(low, v.copy(belly.p).applyMatrix4(bodyIn.matrixWorld).y - belly.r * SCALE * 0.85);
    root.position.set(-cx, -low + p.lift, -cz + p.dz);

    const pulse = p.glow * (0.3 + 0.1 * Math.sin(time * 6));
    for (const r of Object.keys(glow) as Region[]) glow[r].value = regions?.includes(r) ? pulse : 0;
  }

  return { root, joints, apply };
}
