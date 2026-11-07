// `npm run movies`: IMDb-ийн нээлттэй өгөгдлөөс (datasets.imdbws.com, хувийн/арилжааны бус хэрэглээ)
// өндөр үнэлгээтэй, олон хүн үнэлсэн кинонуудыг шүүж public/movies.json үүсгэнэ.
// Постер, товч агуулгыг Wikipedia-гаас (Wikidata-аар IMDb ID-г тааруулж) авна.
import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';

const MIN_RATING = 7.2, MIN_VOTES = 80_000, MIN_YEAR = 1950, MIN_RUNTIME = 70;
const UA = 'SetgelMoodTracker/0.1 (student project; movie catalog build)';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function* tsv(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  const lines = createInterface({ input: Readable.fromWeb(res.body).pipe(createGunzip()), crlfDelay: Infinity });
  let head = null;
  for await (const line of lines) {
    const cols = line.split('\t');
    if (!head) { head = cols; continue; }
    yield cols;
  }
}

console.log('IMDb үнэлгээ…');
const ratings = new Map();
for await (const [id, rating, votes] of tsv('https://datasets.imdbws.com/title.ratings.tsv.gz'))
  if (+votes >= MIN_VOTES && +rating >= MIN_RATING) ratings.set(id, [+rating, +votes]);
console.log(ratings.size, 'гарчиг үнэлгээгээр тэнцэв');

console.log('IMDb гарчгууд…');
const movies = [];
for await (const [id, type, title, , adult, year, , runtime, genres] of tsv('https://datasets.imdbws.com/title.basics.tsv.gz')) {
  const r = ratings.get(id);
  if (!r || type !== 'movie' || adult !== '0' || +year < MIN_YEAR || !(+runtime >= MIN_RUNTIME) || genres === '\\N') continue;
  movies.push({ id, t: title, y: +year, r: r[0], v: r[1], m: +runtime, g: genres.split(',') });
}
console.log(movies.length, 'кино');

// ---- Wikidata: IMDb ID → англи Wikipedia нийтлэл, эх хэл, монгол нэр
const wiki = new Map();
for (let i = 0; i < movies.length; i += 150) {
  const ids = movies.slice(i, i + 150).map(m => `"${m.id}"`).join(' ');
  const q = `SELECT ?imdb ?article ?lang ?mn WHERE { VALUES ?imdb { ${ids} } ?item wdt:P345 ?imdb.
    OPTIONAL { ?article schema:about ?item; schema:isPartOf <https://en.wikipedia.org/>. }
    OPTIONAL { ?item wdt:P364 ?l. ?l wdt:P218 ?lang. }
    OPTIONAL { ?item rdfs:label ?mn. FILTER(LANG(?mn) = "mn") } }`;
  const res = await fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(q), { headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json' } });
  if (!res.ok) { console.error('wikidata', res.status); await sleep(5000); i -= 150; continue; }
  for (const b of (await res.json()).results.bindings) {
    const w = wiki.get(b.imdb.value) ?? { langs: new Set() };
    if (b.article) w.article = decodeURIComponent(b.article.value.split('/wiki/')[1]).replace(/_/g, ' ');
    if (b.lang) w.langs.add(b.lang.value);
    if (b.mn) w.mn = b.mn.value;
    wiki.set(b.imdb.value, w);
  }
  process.stdout.write(`\rWikidata ${Math.min(i + 150, movies.length)}/${movies.length}`);
  await sleep(400);
}
console.log();

// ---- Wikipedia: постер, эхний 2 өгүүлбэр
const byArticle = new Map([...wiki].filter(([, w]) => w.article).map(([id, w]) => [w.article, id]));
const titles = [...byArticle.keys()];
const info = new Map();
for (let i = 0; i < titles.length; i += 20) {
  const batch = titles.slice(i, i + 20);
  const p = new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', redirects: '1', prop: 'extracts|pageimages', exintro: '1', explaintext: '1', exsentences: '2', exlimit: '20', piprop: 'thumbnail', pithumbsize: '342', pilicense: 'any', titles: batch.join('|') });
  const res = await fetch('https://en.wikipedia.org/w/api.php?' + p, { headers: { 'User-Agent': UA } });
  if (!res.ok) { console.error('wikipedia', res.status); await sleep(5000); i -= 20; continue; }
  const j = await res.json();
  const alias = new Map([...(j.query.normalized ?? []), ...(j.query.redirects ?? [])].map(x => [x.to, x.from]));
  for (const pg of j.query.pages ?? []) {
    let key = pg.title;
    while (!byArticle.has(key) && alias.has(key)) key = alias.get(key);
    const id = byArticle.get(key);
    if (id) info.set(id, { plot: (pg.extract ?? '').replace(/\s+/g, ' ').trim().slice(0, 220).replace(/\s\S*$/, '…'), poster: pg.thumbnail?.source?.replace('https://upload.wikimedia.org/wikipedia/', '') });
  }
  process.stdout.write(`\rWikipedia ${Math.min(i + 20, titles.length)}/${titles.length}`);
  await sleep(250);
}
console.log();

const out = movies.map(m => {
  const w = wiki.get(m.id), x = info.get(m.id);
  return { ...m, l: [...(w?.langs ?? [])].slice(0, 2), ...(w?.mn ? { mn: w.mn } : {}), ...(x?.poster ? { p: x.poster } : {}), ...(x?.plot ? { d: x.plot } : {}) };
}).filter(m => m.p && m.d).sort((a, b) => b.v - a.v);
writeFileSync('public/movies.json', JSON.stringify(out));
console.log(`public/movies.json ← ${out.length} кино (${movies.length - out.length} нь постер/агуулгагүй тул хасагдсан)`);
