import { bootFixture, IFixture } from '../../replacements/__tests__/replacements-e2e.fixture';

describe('store admin credits (E2E)', () => {
  let fixture: IFixture;
  let previous: Array<{ credits: number }>;
  const month = new Date().toISOString().slice(0, 7);

  beforeAll(async () => {
    fixture = await bootFixture();
    previous = await fixture.dataSource.query(`SELECT credits FROM firecrawl_usage WHERE month = $1`, [month]);
  });

  afterAll(async () => {
    if (previous.length > 0) {
      await fixture.dataSource.query(`UPDATE firecrawl_usage SET credits = $2 WHERE month = $1`, [month, previous[0]!.credits]);
    } else {
      await fixture.dataSource.query(`DELETE FROM firecrawl_usage WHERE month = $1`, [month]);
    }
    await fixture.close();
  });

  async function setCredits(credits: number): Promise<void> {
    await fixture.dataSource.query(
      `INSERT INTO firecrawl_usage (month, credits) VALUES ($1, $2) ON CONFLICT (month) DO UPDATE SET credits = EXCLUDED.credits`,
      [month, credits],
    );
  }

  it('shows the month\'s credits to an admin only', async () => {
    const admin = await fixture.signUp('credits-admin');
    await fixture.dataSource.query(`UPDATE "user" SET role = 'admin' WHERE email = $1`, [admin.email]);
    const player = await fixture.signUp('credits-player');

    await setCredits(120);
    const open = await fixture.get('/api/admin/stores/cupula-dt/credits', admin.sessionToken).expect(200);
    expect(open.body).toEqual({ creditsUsed: 120, budget: 1000, lookupsStopped: false });

    await setCredits(851);
    const stopped = await fixture.get('/api/admin/stores/cupula-dt/credits', admin.sessionToken).expect(200);
    expect(stopped.body).toEqual({ creditsUsed: 851, budget: 1000, lookupsStopped: true });

    await fixture.get('/api/admin/stores/cupula-dt/credits', player.sessionToken).expect(403);
  });

  it('starts the month at zero credits', async () => {
    const admin = await fixture.signUp('credits-zero');
    await fixture.dataSource.query(`UPDATE "user" SET role = 'admin' WHERE email = $1`, [admin.email]);
    await fixture.dataSource.query(`DELETE FROM firecrawl_usage WHERE month = $1`, [month]);

    const response = await fixture.get('/api/admin/stores/cupula-dt/credits', admin.sessionToken).expect(200);

    expect(response.body).toEqual({ creditsUsed: 0, budget: 1000, lookupsStopped: false });
  });
});
