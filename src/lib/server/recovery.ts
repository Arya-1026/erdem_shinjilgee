import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/* Имэйл илгээдэггүй тул нууц үг мартсан үед сэргээх кодоор солино. Кодыг зөвхөн хэрэглэгчид нэг удаа харуулж,
   өгөгдлийн санд (auth.users.app_metadata) зөвхөн hash-ийг нь хадгална. 60 бит санамсаргүй тул sha256 хангалттай. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // андуурагдах 0, O, 1, I, L-гүй

export function newRecoveryCode() {
  const chars = [...randomBytes(12)].map(b => ALPHABET[b % ALPHABET.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
}

const normalize = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');
export const hashRecoveryCode = (code: string) => createHash('sha256').update(normalize(code)).digest('hex');

export function recoveryCodeMatches(code: string, hash: unknown) {
  if (typeof hash !== 'string') return false;
  const a = Buffer.from(hashRecoveryCode(code)), b = Buffer.from(hash);
  return a.length === b.length && timingSafeEqual(a, b);
}

/* Нэг серверийн санах ойд хадгалах энгийн хязгаар: бүртгэл, код таах оролдлогыг удаашруулна */
const hits = new Map<string, number[]>();
export function rateLimited(key: string, max: number, windowMs: number, now = Date.now()) {
  const recent = (hits.get(key) ?? []).filter(t => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
}

export const clientIp = (req: Request) => req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'local';
