import { cn } from '@/lib/utils';

/* Дасгал бүрийн зураг: апп-д кодоор зурсан тул зохиогчийн эрхгүй, жижиг хэмжээнд ч (44px) тод харагдана. */
const INK = '#3A3550', SKIN = '#F2C49B', WHITE = '#FFFFFF';
const limb = { fill: 'none', stroke: INK, strokeWidth: 7, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

const SCENES: Record<string, { bg: string; art: React.ReactNode }> = {
  // Амьсгал: тэлж буй тойрог, салхи
  e1: {
    bg: '#BFE3EE',
    art: <>
      <circle cx="60" cy="60" r="46" fill={WHITE} opacity=".35" />
      <circle cx="60" cy="60" r="32" fill={WHITE} opacity=".55" />
      <g fill="none" stroke="#2F7F9B" strokeWidth="6" strokeLinecap="round">
        <path d="M28 50h44a10 10 0 1 0-10-10" />
        <path d="M22 64h66a10 10 0 1 1-10 10" />
        <path d="M34 78h24a8 8 0 1 1-8 8" />
      </g>
    </>,
  },
  // Газардуулах: таван хуруутай гар, газарт бат зогсох
  e2: {
    bg: '#CFE6C6',
    art: <>
      <path d="M0 96q30-10 60-3t60-4v31H0z" fill="#8DBE7D" />
      <g fill={SKIN} stroke={INK} strokeWidth="3">
        <rect x="34" y="28" width="11" height="42" rx="5.5" />
        <rect x="47" y="18" width="11" height="52" rx="5.5" />
        <rect x="60" y="20" width="11" height="50" rx="5.5" />
        <rect x="73" y="30" width="11" height="40" rx="5.5" />
        <rect x="16" y="56" width="34" height="11" rx="5.5" transform="rotate(38 33 61)" />
        <path d="M34 62h50v18a20 20 0 0 1-20 20h-10a20 20 0 0 1-20-20z" />
      </g>
    </>,
  },
  // Алхалт: нартай зам дээр алхаж буй хүн
  e3: {
    bg: '#CDE7F7',
    art: <>
      <circle cx="92" cy="28" r="14" fill="#FFD36B" />
      <path d="M0 84q34-24 66-8t54-6v50H0z" fill="#9CCB86" />
      <path d="M38 120q6-22 30-34l10 4q-16 12-16 30z" fill="#E9D9B5" />
      <circle cx="56" cy="30" r="9" fill={SKIN} stroke={INK} strokeWidth="3" />
      <path d="M56 42l-3 24M54 50l-14 9M54 50l14 7M53 66l-12 20M53 66l13 18" {...limb} />
    </>,
  },
  // Иог: бадамлянхуа суудал
  e4: {
    bg: '#E6DAF6',
    art: <>
      <circle cx="60" cy="52" r="38" fill={WHITE} opacity=".5" />
      <path d="M12 104h96" stroke="#A98BD6" strokeWidth="8" strokeLinecap="round" />
      <circle cx="60" cy="30" r="10" fill={SKIN} stroke={INK} strokeWidth="3" />
      <path d="M60 44v32M60 50q-18 12-26 30M60 50q18 12 26 30M34 94q26-16 52 0M28 92q32 10 64 0" {...limb} />
    </>,
  },
  // Талархал: нээлттэй дэвтэр, зүрх
  e5: {
    bg: '#FCE7C2',
    art: <>
      <path d="M16 34q22-8 44 2v62q-22-10-44-2z" fill={WHITE} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M104 34q-22-8-44 2v62q22-10 44-2z" fill={WHITE} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M38 62c-9-8-13-13-13-18 0-7 9-9 13-3 4-6 13-4 13 3 0 5-4 10-13 18z" fill="#E86A7E" />
      <path d="M70 48q12-4 24-2M70 60q12-4 24-2M70 72q12-4 24-2" fill="none" stroke="#C9A25C" strokeWidth="4" strokeLinecap="round" />
    </>,
  },
  // Булчин суллах: дэвсгэр дээр хэвтэж амрах, тайвшрах долгион
  e6: {
    bg: '#FAD7CF',
    art: <>
      <g fill="none" stroke="#E08A76" strokeWidth="5" strokeLinecap="round">
        <path d="M30 34q10-10 20 0t20 0 20 0" />
        <path d="M38 52q8-8 16 0t16 0 16 0" />
      </g>
      <rect x="10" y="88" width="100" height="10" rx="5" fill="#E08A76" />
      <circle cx="26" cy="72" r="9" fill={SKIN} stroke={INK} strokeWidth="3" />
      <path d="M38 78h34l14 4 16-2M46 80q8 4 16 2" {...limb} />
    </>,
  },
  // Энергитэй дасгал: гантель, аянга
  e7: {
    bg: '#FFE08A',
    art: <>
      <path d="M68 10L38 62h20l-8 42 34-58H62z" fill="#FF8A3D" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <g transform="rotate(-18 60 88)">
        <rect x="30" y="84" width="60" height="8" rx="4" fill={INK} />
        <rect x="18" y="72" width="12" height="32" rx="4" fill={INK} />
        <rect x="8" y="78" width="10" height="20" rx="3" fill={INK} />
        <rect x="90" y="72" width="12" height="32" rx="4" fill={INK} />
        <rect x="102" y="78" width="10" height="20" rx="3" fill={INK} />
      </g>
    </>,
  },
  // Зураглах: будгийн палитр, бийр
  e8: {
    bg: '#F6CFE0',
    art: <>
      <path d="M58 22c30 0 50 18 50 40 0 16-14 18-24 16-8-2-14 4-10 12 4 10-6 14-16 14-30 0-46-20-46-42s20-40 46-40z" fill={WHITE} stroke={INK} strokeWidth="3" />
      <circle cx="42" cy="46" r="8" fill="#E86A7E" />
      <circle cx="66" cy="38" r="8" fill="#FFC24B" />
      <circle cx="88" cy="52" r="8" fill="#5AB98C" />
      <circle cx="34" cy="70" r="8" fill="#5A8FD8" />
      <circle cx="54" cy="86" r="8" fill="#A06BD6" />
    </>,
  },
  // Ачаалал задлах: тэмдэглэгээтэй жагсаалт
  e9: {
    bg: '#D6E4FA',
    art: <>
      <rect x="28" y="20" width="64" height="86" rx="8" fill={WHITE} stroke={INK} strokeWidth="3" />
      <rect x="46" y="12" width="28" height="16" rx="5" fill="#5A8FD8" stroke={INK} strokeWidth="3" />
      <path d="M38 46l6 6 10-11M38 68l6 6 10-11" fill="none" stroke="#3FA776" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="39" y="84" width="13" height="13" rx="3" fill="none" stroke={INK} strokeWidth="3" />
      <path d="M62 47h20M62 69h20M62 91h20" stroke="#9DB4D9" strokeWidth="5" strokeLinecap="round" />
    </>,
  },
  // Тайван ярилцах: хоёр яриа, зүрх
  e10: {
    bg: '#F9D4D9',
    art: <>
      <path d="M14 22h60a10 10 0 0 1 10 10v28a10 10 0 0 1-10 10H40L24 84V70H14A10 10 0 0 1 4 60V32a10 10 0 0 1 10-10z" fill={WHITE} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M44 60c-10-8-15-13-15-19 0-7 10-9 15-3 5-6 15-4 15 3 0 6-5 11-15 19z" fill="#E86A7E" />
      <path d="M62 54h44a10 10 0 0 1 10 10v22a10 10 0 0 1-10 10h-6v14L84 96H62a10 10 0 0 1-10-10V64a10 10 0 0 1 10-10z" fill="#8EC6B4" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="70" cy="75" r="4" fill={INK} /><circle cx="84" cy="75" r="4" fill={INK} /><circle cx="98" cy="75" r="4" fill={INK} />
    </>,
  },
  // Хайрцаг амьсгал: дөрвөлжин зам, булан бүрт цэг
  e11: {
    bg: '#D3ECF2',
    art: <>
      <rect x="26" y="26" width="68" height="68" rx="12" fill={WHITE} opacity=".6" />
      <rect x="26" y="26" width="68" height="68" rx="12" fill="none" stroke="#2F7F9B" strokeWidth="6" strokeDasharray="14 8" strokeLinecap="round" />
      <circle cx="26" cy="26" r="7" fill="#FFC24B" stroke={INK} strokeWidth="3" />
      <circle cx="94" cy="26" r="7" fill="#5AB98C" stroke={INK} strokeWidth="3" />
      <circle cx="94" cy="94" r="7" fill="#5A8FD8" stroke={INK} strokeWidth="3" />
      <circle cx="26" cy="94" r="7" fill="#E86A7E" stroke={INK} strokeWidth="3" />
      <text x="60" y="68" textAnchor="middle" fontSize="22" fontWeight="800" fill={INK}>4</text>
    </>,
  },
  // Бие сканнердах: хэвтэж буй хүн, дээгүүр нь гэрлийн зурвас
  e12: {
    bg: '#E3E0F7',
    art: <>
      <rect x="0" y="40" width="120" height="16" fill="#A98BD6" opacity=".35" />
      <rect x="0" y="52" width="120" height="4" fill="#A06BD6" opacity=".7" />
      <rect x="10" y="84" width="100" height="10" rx="5" fill="#A98BD6" />
      <circle cx="24" cy="70" r="9" fill={SKIN} stroke={INK} strokeWidth="3" />
      <path d="M36 76h40l12 2 14-2M50 78l10-8 10 8" {...limb} />
      <path d="M86 26l3 6 6 3-6 3-3 6-3-6-6-3 6-3z" fill="#FFD36B" />
    </>,
  },
  // Хүйтэн ус: дусал, усны цорго
  e13: {
    bg: '#CDE7F7',
    art: <>
      <path d="M20 30h46a10 10 0 0 1 10 10v8H64v-6H20z" fill="#9DB4D9" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <rect x="30" y="18" width="16" height="12" rx="3" fill="#9DB4D9" stroke={INK} strokeWidth="3" />
      <path d="M70 58c-8 12-12 18-12 24a12 12 0 0 0 24 0c0-6-4-12-12-24z" fill="#5A8FD8" stroke={INK} strokeWidth="3" />
      <path d="M48 76c-4 6-6 9-6 12a6 6 0 0 0 12 0c0-3-2-6-6-12zM92 70c-4 6-6 9-6 12a6 6 0 0 0 12 0c0-3-2-6-6-12z" fill="#8FB4E3" stroke={INK} strokeWidth="2.5" />
      <path d="M8 108q26-10 52-2t52-4" fill="none" stroke="#5A8FD8" strokeWidth="5" strokeLinecap="round" />
    </>,
  },
  // Өөртөө захидал: дугтуй, зүрх
  e14: {
    bg: '#F9DCE4',
    art: <>
      <rect x="16" y="34" width="88" height="60" rx="8" fill={WHITE} stroke={INK} strokeWidth="3" />
      <path d="M18 38l42 32 42-32" fill="none" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <path d="M60 66c-10-8-15-13-15-19 0-7 10-9 15-3 5-6 15-4 15 3 0 6-5 11-15 19z" fill="#E86A7E" stroke={INK} strokeWidth="2.5" />
      <path d="M88 18l2.5 5 5 2.5-5 2.5-2.5 5-2.5-5-5-2.5 5-2.5z" fill="#FFC24B" />
    </>,
  },
  // Нойр: сар, од, дэр
  e15: {
    bg: '#3A3F6B',
    art: <>
      <path d="M78 18a26 26 0 1 0 22 40 22 22 0 1 1-22-40z" fill="#FFE08A" />
      <circle cx="30" cy="26" r="2.5" fill={WHITE} /><circle cx="46" cy="44" r="2" fill={WHITE} /><circle cx="22" cy="54" r="1.8" fill={WHITE} />
      <rect x="14" y="80" width="92" height="26" rx="13" fill="#E6DAF6" stroke={INK} strokeWidth="3" />
      <text x="36" y="72" fontSize="16" fontWeight="800" fill="#E6DAF6">z</text><text x="48" y="62" fontSize="12" fontWeight="800" fill="#E6DAF6">z</text>
    </>,
  },
  // Бүжиг: хөгжмийн нот, бүжиглэж буй хүн
  e16: {
    bg: '#FFE3C2',
    art: <>
      <path d="M86 20v34a8 8 0 1 1-6-7.7V26l22-6v26a8 8 0 1 1-6-7.7V20z" fill="#FF8A3D" stroke={INK} strokeWidth="2.5" />
      <circle cx="44" cy="30" r="9" fill={SKIN} stroke={INK} strokeWidth="3" />
      <path d="M44 42l2 26M45 50l-18-10M45 50l16-14M46 68l-14 22M46 68l16 18" {...limb} />
      <path d="M14 104h92" stroke="#F2C49B" strokeWidth="6" strokeLinecap="round" />
    </>,
  },
  // Бодлоо шалгах: бодлын бөмбөлөг, томруулдаг шил
  e17: {
    bg: '#DDEBD6',
    art: <>
      <path d="M22 54a20 20 0 0 1 8-30 22 22 0 0 1 38-6 18 18 0 0 1 24 18 16 16 0 0 1-8 30H34a14 14 0 0 1-12-12z" fill={WHITE} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="28" cy="82" r="5" fill={WHITE} stroke={INK} strokeWidth="2.5" /><circle cx="18" cy="96" r="3" fill={WHITE} stroke={INK} strokeWidth="2" />
      <circle cx="58" cy="44" r="13" fill="#BFE3EE" stroke={INK} strokeWidth="4" />
      <path d="M67 53l12 12" stroke={INK} strokeWidth="6" strokeLinecap="round" />
      <path d="M78 96l8 8 16-18" fill="none" stroke="#3FA776" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </>,
  },
  // Ширээний сунгалт: зөөврийн компьютер, гараа дээш сунгасан хүн
  e18: {
    bg: '#E2EEF9',
    art: <>
      <rect x="12" y="86" width="96" height="8" rx="4" fill="#C9A25C" />
      <path d="M70 86l6-24h30l-6 24z" fill="#9DB4D9" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      <circle cx="40" cy="44" r="9" fill={SKIN} stroke={INK} strokeWidth="3" />
      <path d="M40 56v28M40 60l-10-30M40 60l10-30M30 30l10-14 10 14" {...limb} />
    </>,
  },
  // Мессеж бичих: утас, зүрхтэй яриа
  e19: {
    bg: '#FBE0D6',
    art: <>
      <rect x="36" y="14" width="48" height="92" rx="10" fill={WHITE} stroke={INK} strokeWidth="3" />
      <rect x="52" y="20" width="16" height="4" rx="2" fill={INK} />
      <path d="M44 36h28a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6H56l-8 8v-8h-4a6 6 0 0 1-6-6V42a6 6 0 0 1 6-6z" fill="#8EC6B4" stroke={INK} strokeWidth="2.5" />
      <path d="M58 54c-6-5-9-8-9-11 0-4 6-5 9-2 3-3 9-2 9 2 0 3-3 6-9 11z" fill="#E86A7E" />
      <path d="M46 76h28M46 86h18" stroke="#C7C3BB" strokeWidth="5" strokeLinecap="round" />
    </>,
  },
  // Сайхан мөч: гэрэл зураг, нар
  e20: {
    bg: '#FFF0C2',
    art: <>
      <g transform="rotate(-8 60 64)">
        <rect x="20" y="28" width="80" height="70" rx="6" fill={WHITE} stroke={INK} strokeWidth="3" />
        <rect x="28" y="36" width="64" height="44" rx="3" fill="#CDE7F7" />
        <circle cx="76" cy="50" r="8" fill="#FFD36B" />
        <path d="M28 80l18-18 12 10 12-14 22 22z" fill="#9CCB86" />
      </g>
      <path d="M98 14l3 6 6 3-6 3-3 6-3-6-6-3 6-3zM16 20l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="#FF8A3D" />
    </>,
  },
};

/* Хөдөлгөөнт SVG (public/exercises): дасгалын картууд дээр тоглоно. «Хөдөлгөөн багасгах» асаалттай бол зогсоно.
   <img> хэлбэрээр оруулна: SVG-ийн дотоод id-ууд (bg, card…) хуудсанд давхцахгүй. */
export const EXERCISE_ANIM: Record<string, string> = {
  e1: 'breath', e3: 'walking', e4: 'yoga', e5: 'gratitude', e6: 'relax', e7: 'energy', e8: 'palette', e10: 'chat',
};
export const exerciseAnimSrc = (id: string) => EXERCISE_ANIM[id] && `/exercises/${EXERCISE_ANIM[id]}.svg`;

export function ExerciseArt({ id, className }: { id: string; className?: string }) {
  const src = exerciseAnimSrc(id);
  // eslint-disable-next-line @next/next/no-img-element -- SVG анимаци next/image-ээр тоглохгүй
  if (src) return <img src={src} alt="" aria-hidden="true" draggable={false} className={cn('block object-cover', className)} />;
  const s = SCENES[id];
  if (!s) return null;
  return <svg viewBox="0 0 120 120" className={cn('block', className)} style={{ background: s.bg }} aria-hidden="true">{s.art}</svg>;
}
