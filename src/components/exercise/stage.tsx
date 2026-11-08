'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { ANIM_REGION, ANIMS, mixPose, type AnimId, type View } from '@/lib/exercise-moves';
import type { Character } from './character';
import { buildMannequin } from './mannequin';
import { useT } from '@/components/providers/locale-provider';

/** cycle: өөрчлөгдөхөд хөдөлгөөн эхнээсээ эхэлнэ (ижил анимацитай дараагийн алхамд ч) */
export type StageProps = { anim: AnimId; period: number; running: boolean; cycle: number; view?: View; character?: Character; onFail?: () => void };

// Камерын өнцөг, зай, харах өндөр. Шалан дээрх дасгалд ойртож намсна.
const VIEWS: Record<View, { az: number; r: number; y: number }> = {
  front: { az: 0.28, r: 5.2, y: 0.98 }, angle: { az: 0.8, r: 5.2, y: 0.98 }, side: { az: 1.5, r: 5.2, y: 0.98 }, floor: { az: 1.32, r: 3.7, y: 0.42 },
};
const BLEND_S = 0.7;

/* 3D тайз: загвар анимацийг дагаж, камер дасгал бүрт тохирох өнцгөөс харуулна. Хуруугаар эргүүлж болно. */
export default function ExerciseStage({ anim, period, running, cycle, view = 'front', character = 'human', onFail }: StageProps) {
  const tr = useT();
  const host = useRef<HTMLDivElement>(null);
  // Render loop нь нэг удаа үүсдэг тул сүүлийн утгуудыг ref-ээс уншина
  const live = useRef({ anim, period, running, cycle, view });
  useEffect(() => { live.current = { anim, period, running, cycle, view }; });
  const fail = useRef(onFail);
  useEffect(() => { fail.current = onFail; });

  useEffect(() => {
    const el = host.current!;
    // Утас (хүрэлтийн дэлгэц): нягтрал, сүүдэр, antialias-ийг багасгаж GPU-г хөнгөлнө. 3x дэлгэцийг бүтэн нягтралаар зурах нь хамгийн их ачаалалтай.
    const lite = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 600;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !lite, alpha: true, powerPreference: lite ? 'low-power' : 'default' });
    } catch {
      fail.current?.();
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, lite ? 1.5 : 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = lite ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    // Хэмжээг CSS-ээр өгнө: пикселээр тогтоовол утсан дээр цонхыг дэлгэцнээс өргөн болгож тэлдэг байсан
    Object.assign(renderer.domElement.style, { display: 'block', width: '100%', height: '100%' });

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
    scene.add(new THREE.HemisphereLight('#FFF6E8', '#8C9A94', 1.5));
    const sun = new THREE.DirectionalLight('#FFFFFF', 2.1);
    sun.position.set(1.6, 4.2, 2.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(lite ? 512 : 1024, lite ? 512 : 1024);
    sun.shadow.radius = 5;
    sun.shadow.normalBias = 0.03;
    Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2.4, bottom: -1.6, far: 10 });
    scene.add(sun);

    // Шал, дасгалын дэвсгэр
    const floor = new THREE.Mesh(new THREE.CircleGeometry(2.3, 64), new THREE.ShadowMaterial({ opacity: 0.2 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const mat = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.012, 2.05), new THREE.MeshStandardMaterial({ color: '#A8D8C9', roughness: 0.9 }));
    mat.position.y = 0.002;
    mat.receiveShadow = true;
    scene.add(mat);

    const rig = buildMannequin(character, lite);
    scene.add(rig.root);

    const size = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(size);
    ro.observe(el);
    size();

    // Камер: дасгал солигдоход зөөлөн эргэнэ, хэрэглэгч чирвэл тухайн өнцгөөр нь үлдэнэ
    const start = VIEWS[live.current.view];
    const cam = { az: start.az, r: start.r, y: start.y, el: 0.2, drag: null as null | { x: number; y: number }, manual: false };
    const down = (e: PointerEvent) => { cam.drag = { x: e.clientX, y: e.clientY }; cam.manual = true; };
    const move = (e: PointerEvent) => {
      if (!cam.drag) return;
      cam.az -= (e.clientX - cam.drag.x) * 0.01;
      cam.el = Math.min(1.1, Math.max(0.03, cam.el + (e.clientY - cam.drag.y) * 0.006));
      cam.drag = { x: e.clientX, y: e.clientY };
    };
    const up = () => { cam.drag = null; };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);

    let frame = 0, last = performance.now(), phase = 0, blend = 1, time = 0;
    let curAnim = live.current.anim, curCycle = live.current.cycle, curView = live.current.view;
    let from = ANIMS[curAnim](0), now = from;

    // Дэлгэцэн дээр харагдахгүй (гүйлгэж өнгөрсөн, таб нуугдсан) үед зурахгүй
    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
    io.observe(el);

    const tick = (at: number) => {
      frame = requestAnimationFrame(tick);
      if (!visible || document.hidden) { last = at; return; }
      // Хөдөлгөөн бодит цагаар явна (удаан төхөөрөмж дээр ч тоолууртай таарна), камер зөөлрөлт нь таслагдсан dt-ээр
      const real = (at - last) / 1000, dt = Math.min(0.05, real);
      last = at;
      time += dt;
      const s = live.current;
      if (s.anim !== curAnim || s.cycle !== curCycle) { from = now; curAnim = s.anim; curCycle = s.cycle; phase = 0; blend = 0; }
      if (s.view !== curView) { curView = s.view; cam.manual = false; }
      if (s.running) phase = (phase + real / s.period) % 1;
      blend = Math.min(1, blend + dt / BLEND_S);
      const target = ANIMS[curAnim](phase);
      now = blend < 1 ? mixPose(from, target, blend * blend * (3 - 2 * blend)) : target;
      rig.apply(now, ANIM_REGION[curAnim], time);

      const v = VIEWS[curView], ease = Math.min(1, dt * 3);
      // Босоо нарийн дэлгэцэнд (утас) загвар, хэвтээ дасгал багтахаар камерыг холдуулна
      const fit = Math.max(1, (curView === 'floor' ? 1.3 : 0.62) / camera.aspect);
      // Муур, туулай нь толгой томтой, шалан дээр урт тул бага зэрэг холоос харна
      const zoom = character === 'human' ? 1 : curView === 'floor' ? 1.4 : 1.05;
      if (!cam.manual) cam.az += (v.az - cam.az) * ease;
      cam.r += (v.r * fit * zoom - cam.r) * ease;
      cam.y += (v.y - cam.y) * ease;
      camera.position.set(cam.r * Math.sin(cam.az) * Math.cos(cam.el), cam.y + cam.r * Math.sin(cam.el), cam.r * Math.cos(cam.az) * Math.cos(cam.el));
      camera.lookAt(0, cam.y, 0);
      renderer.render(scene, camera);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      scene.traverse(o => {
        if (!(o instanceof THREE.Mesh)) return;
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [character]);

  return <div ref={host} className="size-full cursor-grab touch-pan-y active:cursor-grabbing" role="img" aria-label={tr('Дасгал үзүүлж буй 3D загвар. Чирж эргүүлнэ.')} />;
}
