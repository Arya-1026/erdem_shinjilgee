import { beforeEach, describe, expect, it, vi } from 'vitest';

const llmSmart = vi.hoisted(() => vi.fn());
const ensureLocale = vi.hoisted(() => vi.fn(async (t: string) => t));
vi.mock('@/lib/server/llm', () => ({ llmSmart, ensureLocale }));

import { CRISIS_FALLBACK } from '@/lib/crisis';
import { crisisReply } from './crisis-reply';

describe('crisisReply', () => {
  beforeEach(() => vi.clearAllMocks());

  it('AI-ийн товч хариултыг буцаана (тусгай заавар, сүүлийн яриа, мессежтэй)', async () => {
    llmSmart.mockResolvedValue({ text: 'Хэлсэнд баярлалаа. Яг одоо аюулгүй байна уу? Юу болсныг ярих уу?', provider: 'test' });
    const history = Array.from({ length: 6 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `msg ${i}` }));
    const reply = await crisisReply('амьдрах хүсэл алга', history, 'Бат', 'mn');
    expect(reply).toBe('Хэлсэнд баярлалаа. Яг одоо аюулгүй байна уу? Юу болсныг ярих уу?');
    const msgs = llmSmart.mock.calls[0][0] as { role: string; content: string }[];
    expect(msgs[0].role).toBe('system');
    expect(msgs[0].content).toMatch(/safe right now/);
    expect(msgs).toHaveLength(1 + 4 + 1); // заавар + сүүлийн 4 + шинэ мессеж
    expect(msgs.at(-1)).toEqual({ role: 'user', content: 'амьдрах хүсэл алга' });
  });

  it('AI унавал тогтмол хариулт (хэрэглэгч хариугүй үлдэхгүй)', async () => {
    llmSmart.mockResolvedValue(null);
    expect(await crisisReply('uhmeer baina', [], '', 'mn')).toBe(CRISIS_FALLBACK);
    llmSmart.mockRejectedValue(new Error('network'));
    expect(await crisisReply('uhmeer baina', [], '', 'mn')).toBe(CRISIS_FALLBACK);
  });

  it('заавраа дагаагүй хэт урт хариултын оронд тогтмол хариулт', async () => {
    llmSmart.mockResolvedValue({ text: 'а'.repeat(700), provider: 'test' });
    expect(await crisisReply('uhmeer baina', [], '', 'mn')).toBe(CRISIS_FALLBACK);
  });

  it('англи хэрэглэгчид англи тогтмол хариулт', async () => {
    llmSmart.mockResolvedValue(null);
    expect(await crisisReply('I want to die', [], '', 'en')).toMatch(/Are you safe right now\?/);
  });

  it('ACTIONS мөрийг хасна', async () => {
    llmSmart.mockResolvedValue({ text: 'Яг одоо аюулгүй байна уу? Би сонсож байна.\nACTIONS: breath', provider: 'test' });
    expect(await crisisReply('uhmeer', [], '', 'mn')).toBe('Яг одоо аюулгүй байна уу? Би сонсож байна.');
  });
});
