import 'server-only';
import { Resend } from 'resend';

const from = () => process.env.EMAIL_FROM || 'Сэтгэл <onboarding@resend.dev>';
const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

// RESEND_API_KEY байхгүй бол имэйл илгээхгүй, зөвхөн log-д бичнэ (локал хөгжүүлэлт).
async function send(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.info(`[email] (RESEND_API_KEY алга) → ${to}: ${subject}`); return { ok: true, skipped: true }; }
  const { error } = await new Resend(key).emails.send({ from: from(), to, subject, html });
  if (error) { console.error('[email]', error); return { ok: false }; }
  return { ok: true };
}

const layout = (body: string) => `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#2B2724">
  <div style="font-size:22px;font-weight:800;margin-bottom:16px">🌙 Сэтгэл</div>${body}
  <p style="font-size:12px;color:#6B635B;margin-top:24px">Энэхүү апп нь мэргэжлийн эмчилгээг орлохгүй. Яаралтай үед 103 руу залгана уу.</p></div>`;

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#2F7A6B;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:600">${label}</a>`;

export const sendReminder = (to: string, name: string) =>
  send(to, 'Өнөөдөр ямар байна? 🌙', layout(`<p>Сайн уу, ${esc(name)}!</p><p>Өнөөдрийн сэтгэл санаагаа 10 секундэд тэмдэглээрэй. Тогтмол бүртгэл таны хэв маягийг илүү нарийн харуулна.</p>${button(`${appUrl()}/home`, 'Бүртгэх')}`));

export const sendExpertNotice = (to: string, b: { client: string; date: string; slot: string; kind: string; share: boolean }) =>
  send(to, `Шинэ захиалга: ${b.date} ${b.slot}`, layout(`<p>Танд шинэ захиалга ирлээ:</p>
    <p><b>${esc(b.client)}</b><br>${esc(b.date)} · ${esc(b.slot)} · ${b.kind === 'video' ? '🎥 Видео' : '💬 Чат'}${b.share ? '<br>📊 Mood тайлангаа хуваалцсан' : ''}</p>
    ${button(`${appUrl()}/expert`, 'Порталд орох')}`));

export const sendBookingConfirmation = (to: string, name: string, b: { expert: string; date: string; slot: string; kind: string }) =>
  send(to, `Захиалга баталгаажлаа: ${b.expert}`, layout(`<p>Сайн уу, ${esc(name)}!</p><p>Таны захиалга баталгаажлаа:</p>
    <p><b>${esc(b.expert)}</b><br>${esc(b.date)} · ${esc(b.slot)} · ${b.kind === 'video' ? '🎥 Видео' : '💬 Чат'}</p>${button(`${appUrl()}/experts`, 'Захиалгаа харах')}`));
