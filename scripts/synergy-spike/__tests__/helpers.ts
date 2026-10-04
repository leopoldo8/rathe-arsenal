import { spawnSync } from 'child_process';
import { mkdtempSync, readdirSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export const SPIKE_DIR = join(__dirname, '..');

export function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'synergy-'));
}

export function listFiles(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir, { recursive: true }).map(String).sort() : [];
}

export function runCli(
  script: string,
  args: string[],
  env: Record<string, string | undefined>,
): { status: number | null; stdout: string; stderr: string } {
  const merged: NodeJS.ProcessEnv = { ...process.env, ...env };
  for (const key of Object.keys(env)) {
    if (env[key] === undefined) delete merged[key];
  }
  const result = spawnSync(
    process.execPath,
    [require.resolve('tsx/cli'), join(SPIKE_DIR, script), ...args],
    { env: merged, encoding: 'utf8' },
  );
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}
