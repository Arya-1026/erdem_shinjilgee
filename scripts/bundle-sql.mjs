// `npm run db:bundle`: Supabase SQL Editor-т нэг дор хуулж ажиллуулах supabase/setup.sql-ийг үүсгэнэ.
// 0002_cron.sql-ийг оруулахгүй: deploy хийсний дараа Vault-д нууц хадгалаад тусад нь ажиллуулна.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = 'supabase/migrations';
const files = readdirSync(dir).filter(f => f.endsWith('.sql') && !f.includes('_cron')).sort();
const body = files.map(f => `-- >>>>>>>>>> ${f}\n${readFileSync(`${dir}/${f}`, 'utf8').trim()}\n`).join('\n');
writeFileSync('supabase/setup.sql', `-- АВТОМАТААР ҮҮСГЭСЭН (npm run db:bundle). Засах бол supabase/migrations/ доторх файлыг засна.
-- Supabase → SQL Editor → New query → энэ файлын бүх агуулгыг хуулж → Run. Хоосон төсөл дээр нэг удаа ажиллуулна.
begin;

${body}
commit;
`);
console.log(`supabase/setup.sql ← ${files.join(', ')}`);
