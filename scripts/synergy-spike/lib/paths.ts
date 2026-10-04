import { join } from 'path';

const SPIKE_DIR = join(__dirname, '..');

/** Outputs live under `out/`; tests point `SYNERGY_OUT_DIR` at a temp directory. */
export function outDir(env: NodeJS.ProcessEnv = process.env): string {
  return env['SYNERGY_OUT_DIR'] ?? join(SPIKE_DIR, 'out');
}

export function decksFile(env: NodeJS.ProcessEnv = process.env): string {
  return env['SYNERGY_DECKS_FILE'] ?? join(SPIKE_DIR, 'fixtures', 'decks.yaml');
}
