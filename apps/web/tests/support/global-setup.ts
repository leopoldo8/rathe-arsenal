import { mkdirSync, writeFileSync } from 'node:fs';
import { seedFixture } from '../../../../scripts/fixture/fixture-seed';
import { AUTH_DIR, BASE_URL, STORAGE_STATE_PATH, fixtureCredentials } from './fixture';

const HANDLES_FILE = `${AUTH_DIR}/fixture.json`;

const SESSION_MAX_AGE_SECONDS = 34_560_000;

export default async function globalSetup(): Promise<void> {
  const handles = await seedFixture(fixtureCredentials());
  mkdirSync(AUTH_DIR, { recursive: true });
  writeFileSync(HANDLES_FILE, JSON.stringify(handles));
  writeFileSync(
    STORAGE_STATE_PATH,
    JSON.stringify({
      // The session is the httpOnly `ra_session` cookie the API set at sign-in (door 17).
      cookies: [
        {
          name: 'ra_session',
          value: handles.sessionToken,
          domain: new URL(BASE_URL).hostname,
          path: '/api',
          expires: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        },
      ],
      origins: [
        {
          origin: new URL(BASE_URL).origin,
          localStorage: [{ name: 'rathe-arsenal:theme', value: 'dark' }],
        },
      ],
    }),
  );
}
