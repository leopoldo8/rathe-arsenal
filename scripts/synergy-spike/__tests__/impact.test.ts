import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';
import { test } from 'node:test';

const ROOT = join(__dirname, '..', '..', '..');

/** git grep exits 1 when nothing matches, which is a valid answer here. */
function gitGrep(command: string, args: string[]): string {
  return spawnSync(command, args, { cwd: ROOT, encoding: 'utf8' }).stdout;
}

test('C31: six synergy scripts, no Anthropic SDK, the model ids only in one config file, and one commented OpenRouter key line in .env.example', () => {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
    devDependencies: Record<string, string>;
    dependencies?: Record<string, string>;
  };
  assert.deepEqual(
    Object.keys(pkg.scripts).filter((s) => s.startsWith('synergy:')).sort(),
    ['synergy:decks', 'synergy:judge', 'synergy:pool', 'synergy:run', 'synergy:score', 'synergy:sheet'],
  );
  assert.equal(pkg.devDependencies['@anthropic-ai/sdk'], undefined);
  assert.equal(pkg.dependencies?.['@anthropic-ai/sdk'], undefined);

  const sdkMentions = gitGrep(
    'git', ['grep', '-l', '@anthropic-ai/sdk', '--', 'package.json', 'scripts', ':!pnpm-lock.yaml', ':!scripts/synergy-spike/__tests__/impact.test.ts'],
  ).trim();
  assert.equal(sdkMentions, '');

  const modelFiles = gitGrep(
    'git', ['grep', '-l', '-E', "openai/gpt-6\\.1-sol|google/gemini-3\\.8-flash|xiaomi/mimo-v2\\.6-pro|anthropic/claude-opus-5\\.5", '--', 'scripts/synergy-spike', ':!scripts/synergy-spike/__tests__', ':!scripts/synergy-spike/out'],
  ).trim().split('\n');
  assert.deepEqual(modelFiles, ['scripts/synergy-spike/lib/models.config.ts']);

  const env = readFileSync(join(ROOT, '.env.example'), 'utf8').split('\n');
  assert.ok(env.some((l) => l.trim() === '# OPENROUTER_API_KEY='));
  assert.ok(env.filter((l) => l.includes('OPENROUTER_API_KEY')).every((l) => l.trim().startsWith('#') && !/=\s*\S/.test(l)));
  assert.ok(!env.some((l) => l.includes('ANTHROPIC_API_KEY')));
});
