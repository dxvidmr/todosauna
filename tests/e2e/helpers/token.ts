import crypto from 'node:crypto';

function toBase64Url(input: Buffer | string): string {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + pad, 'base64');
}

export function decodeTokenPayload<T = Record<string, unknown>>(token: string): T {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) {
    throw new Error('Invalid token format');
  }
  const payloadRaw = fromBase64Url(parts[0]).toString('utf8');
  return JSON.parse(payloadRaw) as T;
}

export function signPayload(payload: Record<string, unknown>, secret: string): string {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${encodedPayload}.${signature}`;
}
