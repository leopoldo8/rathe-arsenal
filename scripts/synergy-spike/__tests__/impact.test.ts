import assert from 'node:assert/strict';
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { test } from 'node:test';

const ROOT = join(__dirname, '..', '..', '..');

test('C31: five synergy scripts, the SDK as a devDependency used only by the spike, and one commented key line in .env.example', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
    devDependencies: Record<string, string>;
    dependencies?: Record<string, string>;
  };
  assert.deepEqual(
    Object.keys(pkg.scripts).filter((s) => s.startsWith('synergy:')).sort(),
    ['synergy:decks', 'synergy:pool', 'synergy:run', 'synergy:score', 'synergy:sheet'],
  );
  assert.ok(pkg.devDependencies['@anthropic-ai/sdk']);
  assert.equal(pkg.dependencies?.['@anthropic-ai/sdk'], undefined);

  const importers = execFileSync(
    'git', ['grep', '-l', '-E', "from '@anthropic-ai/sdk|require\\('@anthropic-ai/sdk", '--', '*.ts', '*.tsx', '*.js', ':!pnpm-lock.yaml'],
    { cwd: ROOT, encoding: 'utf8' },
  ).split('\n').filter((f) => f !== '' && !f.endsWith('impact.test.ts'));
  assert.ok(importers.length > 0);
  for (const file of importers) assert.ok(file.startsWith('scripts/synergy-spike/'), `${file} imports the SDK`);

  const env = readFileSync(join(ROOT, '.env.example'), 'utf8').split('\n').filter((l) => l.includes('ANTHROPIC_API_KEY'));
  assert.ok(env.some((l) => l.trim() === '# ANTHROPIC_API_KEY='));
  assert.ok(env.every((l) => l.trim().startsWith('#') && !/=\s*\S/.test(l)));
});
