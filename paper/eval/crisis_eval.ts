// Ажиллуулах: node --experimental-strip-types --no-warnings paper/eval/crisis_eval.ts [csv файлууд]
// OPENAI_API_KEY тохируулсан бол Moderation давхаргыг мөн шалгана (хэллэгүүд OpenAI руу илгээгдэнэ).
import { readFileSync } from 'node:fs';
const crisisPath = '../../src/lib/crisis.ts';
const { isCrisisText } = await import(crisisPath);

// Засвараас өмнөх шүүлтүүр (харьцуулалтад)
const OLD_RE = /(үхмээр|амиа\s*хорло|өөрийгөө\s*(гэмтээ|ал)|амьдрах\s*хүсэл\s*(алга|байхгүй)|амьдрахыг\s*хүсэхгүй|алга\s*болмоор|бүх\s*юм\s*дуусаасай)/;
const oldFilter = (t: string) => OLD_RE.test(t.toLowerCase());

const files = process.argv.slice(2);
const list = files.length ? files : ['crisis_phrases.csv', 'crisis_dev2.csv', 'crisis_test.csv'];

async function moderation(input: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const res = await fetch('https://api.openai.com/v1/moderations', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'omni-moderation-latest', input }),
  });
  const c = (await res.json()).results?.[0]?.categories ?? {};
  return Boolean(c['self-harm'] || c['self-harm/intent'] || c['self-harm/instructions']);
}

for (const f of list) {
  let raw: string;
  try { raw = readFileSync(new URL(`./${f.replace(/^.*[\/]/, '')}`, import.meta.url), 'utf8'); } catch { continue; }
  const rows = raw.trim().split(/\r?\n/).slice(1).map(l => { const [group, label, ...t] = l.split(','); return { group, label: Number(label), text: t.join(',') }; });
  console.log(`\n=== ${f} (n=${rows.length})`);
  const groups = [...new Set(rows.map(r => r.group))];
  for (const g of groups) {
    const rs = rows.filter(r => r.group === g);
    const mods = await Promise.all(rs.map(r => moderation(r.text)));
    const withMod = process.env.OPENAI_API_KEY ? ` +moderation=${rs.filter((r, i) => isCrisisText(r.text) || mods[i]).length}` : '';
    console.log(`${g}: n=${rs.length} old=${rs.filter(r => oldFilter(r.text)).length} new=${rs.filter(r => isCrisisText(r.text)).length}${withMod}`);
    const wrong = rs.filter(r => isCrisisText(r.text) !== Boolean(r.label)).map(r => r.text);
    if (wrong.length) console.log('   wrong(new):', wrong.join(' | '));
  }
  for (const [name, fn] of [['old', oldFilter], ['new', isCrisisText]] as [string, (t: string) => boolean][]) {
    const pos = rows.filter(r => r.label), neg = rows.filter(r => !r.label);
    const tp = pos.filter(r => fn(r.text)).length, fp = neg.filter(r => fn(r.text)).length;
    console.log(`${name}: TP=${tp}/${pos.length} FP=${fp}/${neg.length} recall=${(tp / pos.length * 100).toFixed(1)}% precision=${tp + fp ? (tp / (tp + fp) * 100).toFixed(1) : '-'}%`);
  }
}
