import { randomBytes } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { decrypt, encrypt } from './crypto';

beforeAll(() => { process.env.TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64'); });

describe('token шифрлэлт', () => {
  it('шифрлээд буцааж тайлна', () => {
    const t = 'BQD-access-token_' + 'x'.repeat(200);
    const c = encrypt(t);
    expect(c).not.toContain('BQD');
    expect(decrypt(c)).toBe(t);
  });
  it('нэг утгыг шифрлэх бүрт өөр үр дүн (санамсаргүй IV)', () => expect(encrypt('a')).not.toBe(encrypt('a')));
  it('өөрчилсөн шифрийг хүлээн авахгүй', () => {
    const [v, iv, tag, data] = encrypt('secret').split('.');
    const tampered = [v, iv, tag, Buffer.from('другое').toString('base64') + data.slice(8)].join('.');
    expect(() => decrypt(tampered)).toThrow();
  });
  it('буруу түлхүүрийн уртыг илрүүлнэ', () => {
    const keep = process.env.TOKEN_ENCRYPTION_KEY;
    process.env.TOKEN_ENCRYPTION_KEY = 'short';
    expect(() => encrypt('a')).toThrow(/32/);
    process.env.TOKEN_ENCRYPTION_KEY = keep;
  });
});
