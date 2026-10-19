import { randomBytes } from 'crypto';

const SHARE_TOKEN_BYTES = 16;
const SHARE_TOKEN_SHAPE = /^[A-Za-z0-9_-]{22}$/;

export function generateShareToken(): string {
  return randomBytes(SHARE_TOKEN_BYTES).toString('base64url');
}

export function isShareTokenShape(value: unknown): value is string {
  return typeof value === 'string' && SHARE_TOKEN_SHAPE.test(value);
}
