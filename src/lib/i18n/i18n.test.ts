import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { CHAT_ACTIONS, chatSystemPrompt, guessActions } from '../chat-prompt';
import { fallbackReply, greeting } from '../chat-fallback';
import { isCrisisText } from '../crisis';
import { suggestPrompt } from '../music-suggest';
import { EN } from './en';
import { isLocale, languageSync, matchesLocale, translateReason, translator, writtenIn } from './index';

const SRC = join(process.cwd(), 'src');
const CYRILLIC = /\p{Script=Cyrillic}/u;
const walk = (d: string): string[] => readdirSync(d).flatMap(n => {
  const p = join(d, n);
  return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) && !/\.test\.|\.d\.ts$/.test(n) ? [p] : [];
});
const parse = (f: string) => ts.createSourceFile(f, readFileSync(f, 'utf8'), ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const FILES = walk(SRC);

/** tr('...') дуудлагын монгол түлхүүрүүд */
function trKeys() {
  const keys = new Set<string>();
  for (const f of FILES) {
    const add = (x: ts.Node): void => {
      if (ts.isStringLiteralLike(x) && CYRILLIC.test(x.text)) keys.add(x.text);
      else if (ts.isConditionalExpression(x)) { add(x.whenTrue); add(x.whenFalse); }
      else if (ts.isParenthesizedExpression(x)) add(x.expression);
      else if (ts.isElementAccessExpression(x) && ts.isObjectLiteralExpression(x.expression)) x.expression.properties.forEach(p => { if (ts.isPropertyAssignment(p)) add(p.initializer); });
    };
    const visit = (n: ts.Node): void => {
      if (ts.isCallExpression(n) && n.expression.getText() === 'tr' && n.arguments[0]) add(n.arguments[0]);
      ts.forEachChild(n, visit);
    };
    visit(parse(f));
  }
  return keys;
}

/** Дэлгэцэд tr()-ээр харагддаг өгөгдөл: бичвэр бүр орчуулгатай байх ёстой */
const DATA_FILES = ['lib/data.ts', 'lib/exercise-moves.ts', 'lib/palettes.ts', 'lib/season.ts'];
function dataStrings() {
  const out = new Set<string>();
  for (const rel of DATA_FILES) {
    const visit = (n: ts.Node): void => {
      if (ts.isStringLiteralLike(n) && CYRILLIC.test(n.text)) out.add(n.text);
      if (ts.isPropertyAssignment(n) && ts.isStringLiteralLike(n.name) && CYRILLIC.test(n.name.text)) out.add(n.name.text);
      ts.forEachChild(n, visit);
    };
    visit(parse(join(SRC, rel)));
  }
  return out;
}

// Компонентийн модулийн түвшний тогтмолууд (NAV, TABS...): ашиглах газар нь tr()-ээр орчуулагддаг
const MODULE_CONSTANTS: [string, string][] = [
  ['app/(app)/experts/page.tsx', 'STATUS'], ['app/(app)/recs/page.tsx', 'TABS'], ['app/(app)/home/page.tsx', 'ROWS'], ['app/(app)/profile/page.tsx', 'MOOD_AUDIENCE_TOAST'],
  ['app/expert/expert-portal.tsx', 'STATUS_LABEL'], ['components/app-shell.tsx', 'NAV'], ['components/chat-widget.tsx', 'MODES'], ['components/dialogs/dialog-host.tsx', 'PHASES'],
  ['components/mood-overview.tsx', 'LEVEL_LABEL'], ['components/music.tsx', 'META'], ['lib/social.ts', 'AUDIENCE'], ['lib/social.ts', 'ERR'], ['lib/chat-prompt.ts', 'CHAT_ACTIONS'],
  ['lib/todo-plan.ts', 'TODO_CATEGORIES'], ['lib/todo-plan.ts', 'EFFORT'], ['lib/music-suggest.ts', 'MOOD_GOALS'], ['lib/mn-songs.ts', 'WHY'],
];
function constantStrings() {
  const out = new Set<string>();
  for (const [rel, name] of MODULE_CONSTANTS) {
    const collect = (n: ts.Node): void => { if (ts.isStringLiteralLike(n) && CYRILLIC.test(n.text)) out.add(n.text); ts.forEachChild(n, collect); };
    const visit = (n: ts.Node): void => {
      if (ts.isVariableDeclaration(n) && n.name.getText() === name && n.initializer) collect(n.initializer);
      ts.forEachChild(n, visit);
    };
    visit(parse(join(SRC, rel)));
  }
  return out;
}

const SOURCE_STRINGS = new Set([...trKeys(), ...dataStrings(), ...constantStrings()]);

describe('англи орчуулга', () => {
  it('кодын бичвэр бүр орчуулгатай', () => {
    expect([...SOURCE_STRINGS].filter(k => !(k in EN))).toEqual([]);
  });
  it('дэлгэцийн шинэ бичвэр орчуулгагүй үлдээгүй', () => {
    // Хөгжүүлэгчийн заавар, хоёр хэлтэй дэлгэц, статик metadata, серверийн мэдэгдлийг алгасна
    const SKIP = /setup-needed|locale-provider|app[\\/]layout|manifest|app[\\/]api[\\/]/;
    const missing: string[] = [];
    for (const f of FILES.filter(x => /[\\/]src[\\/](app|components)[\\/]/.test(x) && !SKIP.test(x))) {
      const visit = (n: ts.Node): void => {
        const text = ts.isStringLiteralLike(n) ? n.text : ts.isJsxText(n) ? n.text.replace(/\s+/g, ' ').trim() : ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) ? n.text : '';
        const skip = ts.isCallExpression(n) && /^console\./.test(n.expression.getText());
        if (CYRILLIC.test(text) && !(text in EN) && !text.includes('Ачаалж байна')) missing.push(`${f.slice(SRC.length)}: ${text}`);
        if (!skip) ts.forEachChild(n, visit);
      };
      visit(parse(f));
    }
    expect(missing).toEqual([]);
  });
  it('Ботгоны хэлдэг үг бүр орчуулгатай', () => {
    // botgo.html нь React биш тул тусад нь шалгана. name: нь нуугдмал товчны нэр, '<' нь хоёр хэлтэй алдааны мөр.
    const html = readFileSync(join(process.cwd(), 'public/botgo/botgo.html'), 'utf8');
    const lines = [...html.matchAll(/(?<!name:\s*)'([^'\n]*\p{Script=Cyrillic}[^'\n]*)'/gu)].map(m => m[1]).filter(s => !s.startsWith('<'));
    expect(lines.length).toBeGreaterThan(10);
    expect(lines.filter(l => !(l in EN))).toEqual([]);
  });
  it('орчуулгад кирилл үсэг үлдээгүй', () => {
    expect(Object.entries(EN).filter(([, v]) => CYRILLIC.test(v))).toEqual([]);
  });
  it('{0}, {1} хувьсагч таарна', () => {
    const vars = (s: string) => [...s.matchAll(/\{(\d+)\}/g)].map(m => m[1]).sort().join();
    expect(Object.entries(EN).filter(([k, v]) => vars(k) !== vars(v)).map(([k]) => k)).toEqual([]);
  });
  it('чатын ACTIONS мөр хэвээр', () => {
    for (const [k, v] of Object.entries(EN)) if (k.includes('ACTIONS:')) expect(v.split('\n').at(-1), k).toBe(k.split('\n').at(-1));
  });
  it('AI үйлдлийн товчнууд орчуулагдана', () => {
    for (const a of Object.values(CHAT_ACTIONS)) expect(EN[a.label], a.label).toBeTruthy();
  });
});

describe('translator', () => {
  it('монгол бол түлхүүрээ, англи бол орчуулгаа буцаана', () => {
    expect(translator('mn')('Хадгалах')).toBe('Хадгалах');
    expect(translator('en')('Хадгалах')).toBe('Save');
  });
  it('хувьсагч орлуулж, хоосныг алгасна', () => {
    expect(translator('mn')('{0} дуу', 3)).toBe('3 дуу');
    expect(translator('en')('{0} дуу', 3)).toBe('3 songs');
    expect(translator('en')('Сонирхол: {0}{1}', 'Yoga', false)).toBe('Interests: Yoga');
  });
  it('1-ийн дараа ганц тоо хэрэглэнэ', () => {
    expect(translator('en')('{0} дуу', 1)).toBe('1 song');
    expect(translator('en')('{0} дуу', 11)).toBe('11 songs');
    expect(translator('en')('{0} дуу', 21)).toBe('21 songs');
    expect(translator('en')(', {0} ажил', 1)).toBe(', 1 task');
    expect(translator('en')('{0} өдрийн өмнө', 1)).toBe('1 days ago'.replace('days', 'day'));
  });
  it('орчуулга дутвал монголоор үлдэнэ', () => {
    expect(translator('en')('Хэрэглэгчийн нэмсэн хобби')).toBe('Хэрэглэгчийн нэмсэн хобби');
  });
  it('isLocale зөвхөн дэмжигдсэн хэлийг хүлээнэ', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('mn')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(null)).toBe(false);
  });
});

describe('төхөөрөмжийн сонголт ба профайлын хэл', () => {
  it('сонгосон хэл нэвтэрсний дараа солигдохгүй, профайлд хадгалагдана', () => {
    expect(languageSync(true, 'en', 'mn')).toEqual({ save: 'mn' });
    expect(languageSync(true, null, 'mn')).toEqual({ save: 'mn' });
    expect(languageSync(true, 'mn', 'en')).toEqual({ save: 'en' });
  });
  it('ижил бол юу ч хийхгүй', () => {
    expect(languageSync(true, 'mn', 'mn')).toEqual({});
  });
  it('сонголтгүй төхөөрөмж дээр профайлын хэлийг ашиглана', () => {
    expect(languageSync(false, 'en', 'mn')).toEqual({ use: 'en' });
    expect(languageSync(false, null, 'mn')).toEqual({});
  });
});

describe('бичвэрийн хэл таних', () => {
  it('англи өгүүлбэр дэх кирилл нэрийг хэл гэж андуурахгүй', () => {
    expect(writtenIn("Hey АРЪЯАБАЛ, it's completely okay to feel calm today")).toBe('en');
    expect(writtenIn('Hi, Б. Сарангэрэл!')).toBe('en');
  });
  it('монгол бичвэрийг таньж, англи үгтэй ч монгол гэж үзнэ', () => {
    expect(writtenIn('Өнөөдөр сэтгэл санаа чинь ямар байна вэ?')).toBe('mn');
    expect(writtenIn('Spotify-аа холбоод дуугаа сонсоорой')).toBe('mn');
    expect(writtenIn('💚 123')).toBeNull();
  });
  it('сонгосон хэлтэй тулгана', () => {
    expect(matchesLocale('Take a short walk today', 'en')).toBe(true);
    expect(matchesLocale('Богино алхалт хийгээрэй', 'en')).toBe(false);
    expect(matchesLocale('Take a short walk today', 'mn')).toBe(false);
    expect(matchesLocale('💚', 'en')).toBe(true);
  });
});

describe('хадгалагдсан шалтгаан', () => {
  it('хэсэг бүрийг орчуулна', () => {
    expect(translateReason('en', '💙 Гунигт чинь нийцэх: Таны дуртай дуучин')).toBe('💙 Meets your sadness: Your favorite artist');
    expect(translateReason('en', 'Таны сонгосон төрөл: Рок')).toBe('Your chosen genre: Rock');
    expect(translateReason('en', '🌿 Тайвшруулах: «Гүйлт» хоббид тань')).toBe('🌿 Calming: For your hobby «Running»');
  });
  it('англи үед AI-ийн монгол бичвэрийг нуух, монгол үед хэвээр', () => {
    expect(translateReason('en', 'Энэ дуу танд тайвшрахад тусална')).toBe('');
    expect(translateReason('mn', 'Энэ дуу танд тайвшрахад тусална')).toBe('Энэ дуу танд тайвшрахад тусална');
    expect(translateReason('mn', 'Helps you relax right now')).toBe('');
    expect(translateReason('mn', 'Таны сонгосон төрөл: Lo-fi')).toBe('Таны сонгосон төрөл: Lo-fi');
  });
});

describe('хямралын англи илрүүлэлт', () => {
  it.each([
    'I want to die', 'i wanna die', 'I want to kill myself', "i don't want to live anymore", 'thinking about suicide', 'I feel suicidal',
    'I keep hurting myself', "I don't want to wake up tomorrow", 'everyone would be better off without me', 'I want to end my life',
    'there is nothing to live for', 'I just want to end it all', 'I wish I were dead', 'life is not worth living', 'I took an overdose',
    "I don’t want to be here", 'I WANT TO DIE',
  ])('эрсдэлтэй: %s', text => expect(isCrisisText(text)).toBe(true));
  it.each([
    "I'm dying to see that movie", 'this exam is killing me', 'I watched Suicide Squad', 'I want to live a better life', 'I am so tired of work', 'my phone died',
    'I want to end this project soon', 'she cut her hair',
  ])('эрсдэлгүй: %s', text => expect(isCrisisText(text)).toBe(false));
  it('монгол илрүүлэлт хэвээр', () => {
    expect(isCrisisText('үхмээр байна')).toBe(true);
    expect(isCrisisText('yhmeer bn')).toBe(true);
  });
});

describe('англи AI чат', () => {
  const base = { name: 'Sam', hobbies: ['Гүйлт'], entries: [], mode: 'calm' as const };
  it('англиар хариулахыг заана, монгол найруулгын хэсэг алга', () => {
    const p = chatSystemPrompt({ ...base, locale: 'en' });
    expect(p).toContain('natural, plain English');
    expect(p).toContain('even if they write in Mongolian');
    expect(p).not.toContain('then reply in Mongolian');
    expect(p).not.toContain('MONGOLIAN WRITING');
    expect(p).toContain('SAFETY');
    expect(p).toContain('ACTIONS: <code>');
    expect(p).toContain('Running');
    expect(p).toContain('anxiety, anger');
    expect(p).not.toMatch(/User: сайн байна уу/);
  });
  it('сэтгэл зүйчийн мэдээлэл англиар очно', () => {
    const p = chatSystemPrompt({ ...base, locale: 'en', experts: [{ id: 'p1', name: 'Б. Сарангэрэл', title: 'Клиник сэтгэл зүйч', spec: ['Түгшүүр'], exp: 8, rating: 4.9, price: 60000 }] });
    expect(p).toContain('Clinical psychologist. Specialties: Anxiety. 8 years');
    expect(p).not.toContain('Мэргэшил');
  });
  it('ая-ны тайлбарыг сонгосон хэлээр хүснэ', () => {
    const t = { mood: 'calm' as const, kind: 'ambient' as const, hobbies: [], artists: [], liked: [], disliked: [], exclude: [], count: 5 };
    expect(suggestPrompt({ ...t, locale: 'en' })[1].content).toContain('short reason in English');
    expect(suggestPrompt(t)[1].content).toContain('short reason in Mongolian');
  });
  it('монгол горим өөрчлөгдөөгүй', () => {
    const p = chatSystemPrompt({ ...base, locale: 'mn' });
    expect(p).toContain('MONGOLIAN WRITING');
    expect(p).toContain('Гүйлт');
  });
  it('англи түлхүүр үгээр дасгал таамаглана', () => {
    expect(guessActions('I am so stressed about my exam')).toEqual(['breath', 'plan']);
    expect(guessActions('my girlfriend and I broke up')).toContain('partner');
  });
  it('нөөц хариулт англиар', () => {
    const tr = translator('en');
    const r = fallbackReply('I have so much stress at work', { name: 'Sam', hobbies: [], entries: [], feedback: {}, mode: 'calm' }, tr);
    expect(CYRILLIC.test(r)).toBe(false);
    expect(r).toContain('ACTIONS: plan, breath');
    expect(greeting('Sam', undefined, tr)).toBe("Hi, Sam! 🌙 How are you feeling today? We can talk about anything, I'm ready to listen.");
  });
});
