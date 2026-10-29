import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(HERE, '../..');
const WORKFLOW_PATH = path.resolve(WEB_ROOT, '../../.github/workflows/ci.yml');

/** Text of one top-level job: from its `  <name>:` line to the next job key, or the end of the file. */
function jobBlock(workflow: string, jobName: string): string {
  const lines = workflow.split('\n');
  const start = lines.findIndex((line) => line === `  ${jobName}:`);
  if (start === -1) return '';
  const end = lines.findIndex((line, index) => index > start && /^ {2}[A-Za-z0-9_-]+:/.test(line));
  return lines.slice(start, end === -1 ? undefined : end).join('\n');
}

describe('CI workflow', () => {
  it('axe is a dev dependency of the web app', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(WEB_ROOT, 'package.json'), 'utf-8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(manifest.devDependencies).toHaveProperty('@axe-core/playwright');
    expect(manifest.dependencies ?? {}).not.toHaveProperty('@axe-core/playwright');
  });

  it('the web-e2e job runs Playwright against Postgres 16', () => {
    const job = jobBlock(fs.readFileSync(WORKFLOW_PATH, 'utf-8'), 'web-e2e');

    expect(job).not.toBe('');
    expect(job).toContain('image: postgres:16');
    expect(job).toContain('playwright install --with-deps chromium');
    expect(job).toContain('playwright test --project=e2e-chromium');
    expect(job).toContain('APP_BASE_URL: http://localhost:5173');
    expect(job).not.toContain('continue-on-error: true');
  });
});
