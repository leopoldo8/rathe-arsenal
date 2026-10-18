import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';

export const USER_AGENT = 'RatheArsenalPriceSpike/0.1 (personal project; one-off research)';
const MIN_INTERVAL_MS = 1000;

let lastRequestAt = 0;

async function waitTurn(): Promise<void> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
}

/** Fetches JSON at most once per URL: a file already on disk is reused, and live requests keep to one per second. */
export async function fetchJsonCached(url: string, cachePath: string): Promise<unknown> {
  if (existsSync(cachePath)) return JSON.parse(readFileSync(cachePath, 'utf8'));
  await waitTurn();
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${response.status} for ${url}`);
  const text = await response.text();
  mkdirSync(dirname(cachePath), { recursive: true });
  writeFileSync(cachePath, text);
  return JSON.parse(text);
}
