// `npm run keys`: .env.local-д хуулах нууц утгуудыг үүсгэнэ
import { randomBytes } from 'node:crypto';
import webpush from 'web-push';

const vapid = webpush.generateVAPIDKeys();
console.log(`# ↓ .env.local руу хуулна
CRON_SECRET=${randomBytes(24).toString('base64url')}
NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapid.publicKey}
VAPID_PRIVATE_KEY=${vapid.privateKey}`);
