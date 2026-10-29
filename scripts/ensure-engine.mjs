// Runs after `pnpm install`: the API and the web app import @rathe-arsenal/engine from its built
// `dist`, which a fresh clone does not have. Building it here means nobody has to remember the step.
// A failure only warns, so an install in a place without the dev tools (a production-only install) never breaks.
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (!existsSync(path.join(root, 'packages/engine/dist/index.js'))) {
  try {
    execSync('pnpm --filter @rathe-arsenal/engine build', { cwd: root, stdio: 'inherit' });
  } catch {
    console.warn('Could not build packages/engine. Run `pnpm engine:build` before dev, typecheck, lint or test.');
  }
}
