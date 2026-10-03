import { seedFixture } from './fixture/fixture-seed';

async function main(): Promise<void> {
  const handles = await seedFixture({
    baseUrl: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    email: process.env.FIXTURE_EMAIL ?? 'fixture@test.local',
    password: process.env.FIXTURE_PASS ?? 'test-password-1234',
  });
  console.log(`fixture ready: swap deck ${handles.swapDeckId}, ready deck ${handles.readyDeckId}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
