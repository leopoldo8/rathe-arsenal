import { join } from 'path';

const SPIKE_DIR = join(__dirname, '..');

export function outDir(env: NodeJS.ProcessEnv = process.env): string {
  return env['PRICE_OUT_DIR'] ?? join(SPIKE_DIR, 'out');
}

export const DECKS_DIR = join(SPIKE_DIR, '..', 'synergy-spike', 'out', 'decks');
