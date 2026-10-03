import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { approveSwaps, resetFixtureState, type IFixtureCredentials } from '../../../../scripts/fixture/fixture-seed';

export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173';

export const AUTH_DIR = fileURLToPath(new URL('../.auth', import.meta.url));
export const STORAGE_STATE_PATH = `${AUTH_DIR}/state.json`;
export const ANON_STORAGE_STATE = { cookies: [], origins: [] };

const HANDLES_PATH = `${AUTH_DIR}/fixture.json`;

export interface IFixtureFile {
  readonly jwt: string;
  readonly swapDeckId: number;
  readonly readyDeckId: number;
}

export function fixtureCredentials(): IFixtureCredentials {
  return {
    baseUrl: BASE_URL,
    email: process.env.FIXTURE_EMAIL ?? 'fixture@test.local',
    password: process.env.FIXTURE_PASS ?? 'test-password-1234',
  };
}

export function loadFixture(): IFixtureFile {
  return JSON.parse(readFileSync(HANDLES_PATH, 'utf8')) as IFixtureFile;
}

export async function resetFixture(): Promise<void> {
  await resetFixtureState(fixtureCredentials(), loadFixture().jwt);
}

export async function arrangeApprovedSwaps(count: number): Promise<void> {
  await approveSwaps(fixtureCredentials(), loadFixture().jwt, count);
}
