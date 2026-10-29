// `pnpm env:init`: creates the local .env from .env.example, with a generated JWT_SECRET and the
// sign-in answers switched on (EXPOSE_DEV_SECRETS), so a newcomer needs no inbox and no third-party account.
// The API refuses to start with EXPOSE_DEV_SECRETS when NODE_ENV=production, and .env.example keeps it off.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, '.env');

if (existsSync(target)) {
  console.log('.env already exists, left untouched.');
  process.exit(0);
}

const example = readFileSync(path.join(root, '.env.example'), 'utf8');
const env = example
  .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${randomBytes(32).toString('hex')}`)
  .replace(/^# EXPOSE_DEV_SECRETS=true$/m, 'EXPOSE_DEV_SECRETS=true');

writeFileSync(target, env);
console.log('.env created for local development.');
