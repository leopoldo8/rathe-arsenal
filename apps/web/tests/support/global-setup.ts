import { mkdirSync, writeFileSync } from 'node:fs';
import { seedFixture } from '../../../../scripts/fixture/fixture-seed';
import { AUTH_DIR, BASE_URL, STORAGE_STATE_PATH, fixtureCredentials } from './fixture';

const HANDLES_FILE = `${AUTH_DIR}/fixture.json`;

export default async function globalSetup(): Promise<void> {
  const handles = await seedFixture(fixtureCredentials());
  mkdirSync(AUTH_DIR, { recursive: true });
  writeFileSync(HANDLES_FILE, JSON.stringify(handles));
  writeFileSync(
    STORAGE_STATE_PATH,
    JSON.stringify({
      cookies: [],
      origins: [
        {
          origin: new URL(BASE_URL).origin,
          localStorage: [
            { name: 'rathe-arsenal:jwt', value: handles.jwt },
            { name: 'rathe-arsenal:theme', value: 'dark' },
          ],
        },
      ],
    }),
  );
}
