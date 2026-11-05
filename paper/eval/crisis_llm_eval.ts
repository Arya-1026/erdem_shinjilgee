// Гурван давхаргын шалгалт. Ажиллуулах:
//   node --env-file=.env.local --experimental-strip-types --no-warnings paper/eval/crisis_llm_eval.ts crisis_test.csv
// Зохиомол хэллэгүүд Groq (мөн түлхүүр байвал OpenAI) руу илгээгдэнэ. Минутын хязгаарт орохгүйн тулд дарааллаар явна.
import { readFileSync } from 'node:fs';

const crisisPath = '../../src/lib/crisis.ts';
const { isCrisisText, crisisClassifierPrompt, parseCrisisVerdict } = await import(crisisPath);
const model = process.env.GROQ_CHAT_MODEL || 'openai/gpt-oss-120b';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function classify(text: string): Promise<boolean | null> {
  for (let i = 0; i < 6; i++) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({ model, messages: crisisClassifierPrompt(text), temperature: 0, max_tokens: 200, reasoning_effort: 'low' }),
    });
    if (res.status === 429) { await sleep((Number(res.headers.get('retry-after')) || 10) * 1000 + 500); continue; }
    if (!res.ok) { console.error('groq', res.status); return null; }
    return parseCrisisVerdict((await res.json()).choices?.[0]?.message?.content);
  }
  return null;
}

for (const f of process.argv.slice(2)) {
  const rows = readFileSync(new URL(`./${f}`, import.meta.url), 'utf8').trim().split(/\r?\n/).slice(1)
    .map(l => { const [group, label, ...t] = l.split(','); return { group, label: Number(label), text: t.join(',') }; });
  const res = [];
  for (const r of rows) {
    const kw: boolean = isCrisisText(r.text);
    const llm = await classify(r.text);
    res.push({ ...r, kw, llm, all: kw || llm === true });
    await sleep(1200);
  }
  console.log(`\n=== ${f} n=${rows.length} model=${model} failed=${res.filter(r => r.llm === null).length}`);
  for (const g of new Set(res.map(r => r.group))) {
    const rs = res.filter(r => r.group === g);
    console.log(`${g}: n=${rs.length} keyword=${rs.filter(r => r.kw).length} llm=${rs.filter(r => r.llm).length} combined=${rs.filter(r => r.all).length}`);
    const wrong = rs.filter(r => r.all !== Boolean(r.label)).map(r => r.text);
    if (wrong.length) console.log('   wrong(combined):', wrong.join(' | '));
  }
  const pos = res.filter(r => r.label), neg = res.filter(r => !r.label);
  const tp = pos.filter(r => r.all).length, fp = neg.filter(r => r.all).length;
  console.log(`combined: TP=${tp}/${pos.length} FP=${fp}/${neg.length} recall=${(tp / pos.length * 100).toFixed(1)}% precision=${(tp / (tp + fp) * 100).toFixed(1)}%`);
}
