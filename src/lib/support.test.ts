import { describe, expect, it } from 'vitest';
import { joinSupport, parseSupport, splitSupport } from './support';

describe('өдрийн дэмжлэг', () => {
  it('алхмын эхэнд загварын бичсэн дугаар, тэмдгийг хасна', () => {
    const s = parseSupport('{"msg":"Сайн байна.","steps":["1. 10 минут алхаарай","2) Дуу сонсоорой","- Цай уугаарай","3Ус уугаарай"]}');
    expect(s?.steps).toEqual(['10 минут алхаарай', 'Дуу сонсоорой', 'Цай уугаарай', 'Ус уугаарай']);
    // Дугаар биш, алхмын нэг хэсэг болох тоог үлдээнэ
    expect(parseSupport('{"msg":"Сайн.","steps":["10 минут уншаарай"]}')?.steps).toEqual(['10 минут уншаарай']);
  });

  it('засварт нэгтгээд буцааж задлахад бүтэц хадгалагдана', () => {
    const s = { message: 'Өнөөдөр тайван байгаа чинь сайхан.', steps: ['10 минут алхаарай', 'Дуу сонсоорой'] };
    expect(splitSupport(joinSupport(s), s)).toEqual(s);
    expect(splitSupport('Засварласан үг.\n- Нэг алхам', s)).toBeNull();
  });
});
