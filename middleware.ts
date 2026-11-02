// Routing Middleware de Vercel: protege todo el sitio con autenticación
// básica HTTP. Ver docs/proteccion-acceso.md.
import { next } from '@vercel/functions';

const REALM = 'Todos a una';
const NOINDEX = 'noindex';

export const config = {
  // Sin matcher explícito se ejecuta en todas las rutas; se deja así a
  // propósito para cubrir también imágenes, CSV, JSON y XML.
  runtime: 'nodejs'
};

function unauthorized(): Response {
  return new Response('Acceso restringido.', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${REALM}"`,
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': NOINDEX
    }
  });
}

function decodeBasic(header: string | null): { user: string; password: string } | null {
  if (!header) return null;
  const match = /^Basic\s+([A-Za-z0-9+/=]+)\s*$/i.exec(header);
  if (!match) return null;
  let decoded: string;
  try {
    const binary = atob(match[1]);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  const sep = decoded.indexOf(':');
  if (sep < 0) return null;
  return { user: decoded.slice(0, sep), password: decoded.slice(sep + 1) };
}

async function digest(value: string): Promise<Uint8Array> {
  const data = new TextEncoder().encode(value);
  return new Uint8Array(await crypto.subtle.digest('SHA-256', data));
}

// Compara resúmenes SHA-256 de longitud fija recorriendo siempre todos los
// bytes, para que el tiempo no dependa de dónde difieren las cadenas.
async function safeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([digest(a), digest(b)]);
  let diff = 0;
  for (let i = 0; i < da.length; i++) diff |= da[i] ^ db[i];
  return diff === 0;
}

export default async function middleware(request: Request): Promise<Response> {
  const expectedUser = process.env.SITE_USER;
  const expectedPassword = process.env.SITE_PASSWORD;

  // Sin credenciales configuradas se deniega el acceso.
  if (!expectedUser || !expectedPassword) return unauthorized();

  const given = decodeBasic(request.headers.get('authorization'));
  if (!given) return unauthorized();

  // Se evalúan ambas comparaciones siempre, sin cortocircuito.
  const [userOk, passwordOk] = await Promise.all([
    safeEqual(given.user, expectedUser),
    safeEqual(given.password, expectedPassword)
  ]);
  if (!(userOk && passwordOk)) return unauthorized();

  return next({ headers: { 'X-Robots-Tag': NOINDEX } });
}
