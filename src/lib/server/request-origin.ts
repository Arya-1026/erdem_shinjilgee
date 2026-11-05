import 'server-only';

/** Хөтөчийн хандсан хаяг. Dev сервер дээр req.url үргэлж localhost байдаг тул Host толгойг уншина. */
export function requestOrigin(req: Request) {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (!host) return new URL(req.url).origin;
  return `${req.headers.get('x-forwarded-proto') ?? new URL(req.url).protocol.replace(':', '')}://${host}`;
}
