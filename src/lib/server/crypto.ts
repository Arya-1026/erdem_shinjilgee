import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// Spotify-ийн OAuth token-уудыг өгөгдлийн санд AES-256-GCM-ээр шифрлэж хадгална.
// TOKEN_ENCRYPTION_KEY: 32 байтын base64 түлхүүр (`npm run keys`). SPOTIFY_TOKEN_KEY нь хуучин нэр.
export const tokenKeyConfigured = () => Boolean(process.env.TOKEN_ENCRYPTION_KEY || process.env.SPOTIFY_TOKEN_KEY);

function key() {
  const k = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY || process.env.SPOTIFY_TOKEN_KEY || '', 'base64');
  if (k.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY нь 32 байтын base64 утга байх ёстой');
  return k;
}

export function encrypt(plain: string) {
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), data.toString('base64')].join('.');
}

export function decrypt(token: string) {
  const [v, iv, tag, data] = token.split('.');
  if (v !== 'v1') throw new Error('unknown token format');
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
}
