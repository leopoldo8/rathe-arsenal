import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import type { IDeckFile, IPoolFile, IRunFile, TCandidateName } from './types';

export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function listJson(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => join(dir, f));
}

export function readDecks(out: string): IDeckFile[] {
  return listJson(join(out, 'decks')).map((p) => readJson<IDeckFile>(p));
}

export function readPool(out: string, deck: string): IPoolFile {
  return readJson<IPoolFile>(join(out, 'pools', `${deck}.json`));
}

export function runPath(out: string, candidate: TCandidateName, deck: string): string {
  return join(out, 'runs', candidate, `${deck}.json`);
}

export function readRuns(out: string, candidate: TCandidateName): IRunFile[] {
  return listJson(join(out, 'runs', candidate)).map((p) => readJson<IRunFile>(p));
}
