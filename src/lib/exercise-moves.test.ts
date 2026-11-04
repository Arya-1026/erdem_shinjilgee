import { describe, expect, it } from 'vitest';
import { RECS } from './data';
import { ANIMS, cueAt, EXERCISE_MOVES, JOINTS, mixPose, totalSeconds, type AnimId, type Move } from './exercise-moves';

const ids = Object.keys(ANIMS) as AnimId[];

describe('3D дасгал', () => {
  it('бүх анимаци бүх явцад тоон байрлал гаргана', () => {
    for (const id of ids) for (let p = 0; p <= 1; p += 0.05) {
      const pose = ANIMS[id](p);
      for (const j of JOINTS) expect(pose[j].every(Number.isFinite), `${id} ${j} ${p}`).toBe(true);
    }
  });
  it('давталт эхлэл, төгсгөлдөө таарч үсрэлтгүй үргэлжилнэ', () => {
    for (const id of ids) {
      const a = ANIMS[id](0), b = ANIMS[id](0.9999);
      for (const j of JOINTS) a[j].forEach((v, i) => expect(Math.abs(v - b[j][i]), `${id} ${j}`).toBeLessThan(1.5));
    }
  });
  it('байрлал холих', () => {
    const a = ANIMS.idle(0), b = ANIMS.plank(0);
    expect(mixPose(a, b, 0).root).toEqual(a.root);
    expect(mixPose(a, b, 1).root).toEqual(b.root);
  });
  it('заавар давталт дотроо солигдоно', () => {
    const m = EXERCISE_MOVES.e6[0] as Move;
    expect(cueAt(m, 1)).toBe('Чангал');
    expect(cueAt(m, 6)).toBe('Сулла, амьсгаа гарга');
    expect(cueAt(m, 15 + 1)).toBe('Чангал');
  });
  it('картан дээрх минут бодит хугацаатай таарна', () => {
    for (const r of RECS.filter(x => x.moves)) {
      const min = /^(\d+) мин/.exec(r.sub)?.[1];
      if (min) expect(Math.abs(totalSeconds(r.moves!) / 60 - Number(min)), r.id).toBeLessThan(1);
    }
  });
});
