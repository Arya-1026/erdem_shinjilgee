import { describe, expect, it } from 'vitest';
import { recommendMovies, watchlistMovies, type Movie } from './movies';

const mk = (id: string, g: string[], o: Partial<Movie> = {}): Movie => ({ id, t: id, y: 2010, r: 8, v: 500_000, m: 110, g, l: ['en'], p: 'x.jpg', d: 'plot', ...o });
const catalog: Movie[] = [
  mk('horror', ['Horror', 'Thriller'], { r: 8.5 }),
  mk('war', ['Drama', 'War'], { r: 8.6 }),
  mk('comedy', ['Comedy', 'Family']),
  mk('anim', ['Animation', 'Adventure']),
  mk('anime', ['Animation', 'Fantasy'], { l: ['ja'], r: 7.6 }),
  mk('kdrama', ['Drama', 'Romance'], { l: ['ko'], r: 7.4 }),
  mk('doc', ['Documentary'], { r: 7.5 }),
  mk('sport', ['Sport', 'Drama'], { r: 7.6 }),
];
const base = { hobbies: [] as string[], birthYear: null, feedback: {} as Record<string, number>, seed: 'x' };

describe('кино санал болгох', () => {
  it('түгшсэн, гунигтай үед аймшгийн, дайны кино гарахгүй', () => {
    for (const mood of ['anxious', 'sad', 'angry', 'tired'] as const) {
      const ids = recommendMovies(catalog, { ...base, mood }).map(r => r.id);
      expect(ids, mood).not.toContain('horror');
      expect(ids, mood).not.toContain('war');
    }
  });
  it('гунигтай үед инээдмийн, гэр бүлийн кино эхэнд', () => {
    expect(recommendMovies(catalog, { ...base, mood: 'sad' })[0].id).toBe('comedy');
  });
  it('хобби: анимэ, K-драма хэлээр нь илүү оноо авна', () => {
    expect(recommendMovies(catalog, { ...base, mood: 'calm', hobbies: ['Анимэ'] })[0].id).toBe('anime');
    expect(recommendMovies(catalog, { ...base, mood: 'calm', hobbies: ['K-драма'] })[0]).toMatchObject({ id: 'kdrama', hob: true });
  });
  it('хоббид тохирох кино эхэнд, бусад нь зөвхөн нөхөж гарна', () => {
    // «Гүйлт» → Спорт ангилал → Sport/Action; «Хоол хийх» → Comedy/Family
    const ids = recommendMovies(catalog, { ...base, mood: 'calm', hobbies: ['Гүйлт', 'Хоол хийх'] }, 3).map(r => r.id);
    expect(ids.slice(0, 2).sort()).toEqual(['comedy', 'sport']);
  });
  it('тусгай холбоосгүй хобби ангиллаараа кинонд нөлөөлнө', () => {
    // «Йог» → Бясалгал ангилал → Documentary/Drama
    const recs = recommendMovies(catalog, { ...base, mood: 'neutral', hobbies: ['Йог'] }, 3);
    expect(recs.every(r => r.hob)).toBe(true);
    expect(recs.every(r => r.sub.includes('Баримтат') || r.sub.includes('Драм'))).toBe(true);
  });
  it('аймшгийн кинонд дуртай ч сэтгэл санаа сайн үед л гарна', () => {
    expect(recommendMovies(catalog, { ...base, mood: 'happy', hobbies: ['Аймшгийн кино'] }).map(r => r.id)).toContain('horror');
    expect(recommendMovies(catalog, { ...base, mood: 'anxious', hobbies: ['Аймшгийн кино'] }).map(r => r.id)).not.toContain('horror');
  });
  it('👎 дарсныг хасаж, 👍 төрлийг илүүд үзнэ', () => {
    const before = recommendMovies(catalog, { ...base, mood: 'neutral' }).findIndex(r => r.id === 'sport');
    const recs = recommendMovies(catalog, { ...base, mood: 'neutral', feedback: { comedy: -1, sport: 1 } });
    expect(recs.map(r => r.id)).not.toContain('comedy');
    expect(recs.findIndex(r => r.id === 'sport')).toBeLessThan(before);
  });
  it('18-аас доош насныханд аймшгийн кино гарахгүй', () => {
    const ids = recommendMovies(catalog, { ...base, mood: 'happy', hobbies: ['Аймшгийн кино'], birthYear: new Date().getFullYear() - 14 }).map(r => r.id);
    expect(ids).not.toContain('horror');
  });
  it('карт: IMDb үнэлгээ, монгол төрлийн нэр, тайлбар, холбоос', () => {
    const r = recommendMovies(catalog, { ...base, mood: 'sad' })[0];
    expect(r.sub).toBe('⭐ 8.0 IMDb · Инээдмийн, Гэр бүлийн');
    expect(r.why).toContain('IMDb 8.0');
    expect(r.imdb).toBe('https://www.imdb.com/title/comedy/');
    expect(r.poster).toBe('https://upload.wikimedia.org/wikipedia/x.jpg');
  });
});

describe('үзэх жагсаалт', () => {
  it('жагсаалтыг нэмсэн дарааллаар, каталогт байхгүйг алгасаж гаргана', () => {
    expect(watchlistMovies(catalog, ['doc', 'm1', 'comedy'], { ...base, mood: 'calm' }).map(r => r.id)).toEqual(['doc', 'comedy']);
  });
  it('жагсаалтад байгаа кино санал болгох хэсэгт давхардахгүй', () => {
    expect(recommendMovies(catalog, { ...base, mood: 'sad', watchlist: ['comedy'] }).map(r => r.id)).not.toContain('comedy');
  });
});
