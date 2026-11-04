export const pad = (n: number) => String(n).padStart(2, '0');
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const today = () => ymd(new Date());
export const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
// "YYYY-MM-DD" → гараг (0 = Ням). Цагийн бүсийн шилжилтээс сэргийлж үд дунд гэж тооцно.
export const weekdayOf = (date: string) => new Date(date + 'T12:00').getDay();
export const fmtSec = (s: number) => `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}`;
