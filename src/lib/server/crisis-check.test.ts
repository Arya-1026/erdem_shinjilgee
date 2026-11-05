import { beforeEach, describe, expect, it, vi } from 'vitest';

const llmClassify = vi.hoisted(() => vi.fn());
const flagsSelfHarm = vi.hoisted(() => vi.fn());
vi.mock('@/lib/server/llm', () => ({ llmClassify }));
vi.mock('@/lib/server/moderation', () => ({ flagsSelfHarm }));

import { detectCrisis } from './crisis-check';

describe('detectCrisis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    flagsSelfHarm.mockResolvedValue(false);
    llmClassify.mockResolvedValue({ text: 'SAFE', provider: 'test' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('түлхүүр үг илэрвэл гадны үйлчилгээ дуудахгүй', async () => {
    expect(await detectCrisis('uhmeer baina')).toBe(true);
    expect(llmClassify).not.toHaveBeenCalled();
    expect(flagsSelfHarm).not.toHaveBeenCalled();
  });

  it('далд илэрхийллийг утгын ангилал барина', async () => {
    llmClassify.mockResolvedValue({ text: 'RISK', provider: 'test' });
    expect(await detectCrisis('Амьдрахаас залхлаа')).toBe(true);
  });

  it('Moderation илрүүлбэл ангилал SAFE байсан ч true', async () => {
    flagsSelfHarm.mockResolvedValue(true);
    expect(await detectCrisis('some text')).toBe(true);
  });

  it('бүгд SAFE бол false', async () => {
    expect(await detectCrisis('Өнөөдөр ядарч байна')).toBe(false);
  });

  it('ангилал унавал чатыг зогсоохгүй', async () => {
    llmClassify.mockResolvedValue(null);
    expect(await detectCrisis('Өнөөдөр ядарч байна')).toBe(false);
    llmClassify.mockRejectedValue(new Error('down'));
    expect(await detectCrisis('Өнөөдөр ядарч байна')).toBe(false);
  });

  it('өмнөх мессежийг ангилалд дамжуулна', async () => {
    await detectCrisis('Тийм ээ', ['Амьдрах хүсэлгүй болоод байна уу гэж бодлоо']);
    expect(llmClassify.mock.calls[0][0][1].content).toContain('Амьдрах хүсэлгүй');
  });
});
