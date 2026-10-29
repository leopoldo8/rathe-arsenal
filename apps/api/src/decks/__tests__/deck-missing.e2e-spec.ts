import request from 'supertest';
import { ADRENALINE, bootFixture, COAX, EMISSARY, FLEX, IFixture } from '../../replacements/__tests__/replacements-e2e.fixture';

const CARDS = [EMISSARY, FLEX, COAX, ADRENALINE];
const DAY_MS = 24 * 60 * 60 * 1000;

interface IMissingLine {
  readonly cardIdentifier: string;
  readonly deckNeeded: number;
  readonly inventoryNeeded: number;
  readonly state: string;
}

describe('deck missing list (E2E)', () => {
  let fixture: IFixture;
  let storeId: number;
  let createdStore = false;
  let savedPassAt: Date | null = null;
  let savedStock: Array<Record<string, unknown>> = [];
  const passAt = new Date(Date.now() - DAY_MS);

  beforeAll(async () => {
    fixture = await bootFixture();
    const db = fixture.dataSource;
    const existing: Array<{ id: number; lastAvailabilityPassAt: Date | null }> = await db.query(
      `SELECT id, "lastAvailabilityPassAt" FROM store WHERE slug = 'cupula-dt'`,
    );
    if (existing.length === 0) {
      const created: Array<{ id: number }> = await db.query(
        `INSERT INTO store (slug, name, "baseUrl", "listingPath", "rateLimitMs", active)
         VALUES ('cupula-dt', 'Cúpula DT', 'https://www.cupuladt.com.br', '/?view=ecom/itens&tcg=8', 1500, true) RETURNING id`,
      );
      storeId = created[0]!.id;
      createdStore = true;
    } else {
      storeId = existing[0]!.id;
      savedPassAt = existing[0]!.lastAvailabilityPassAt;
    }
    savedStock = await db.query(`SELECT * FROM store_stock WHERE "storeId" = $1 AND "cardIdentifier" = ANY($2)`, [storeId, CARDS]);
    await db.query(`DELETE FROM store_stock WHERE "storeId" = $1 AND "cardIdentifier" = ANY($2)`, [storeId, CARDS]);
    await db.query(`UPDATE store SET "lastAvailabilityPassAt" = $2, active = true WHERE id = $1`, [storeId, passAt]);
  });

  afterAll(async () => {
    const db = fixture.dataSource;
    await db.query(`DELETE FROM variant_fetch_job WHERE "cardIdentifier" = ANY($1)`, [CARDS]);
    await db.query(`DELETE FROM store_stock WHERE "storeId" = $1 AND "cardIdentifier" = ANY($2)`, [storeId, CARDS]);
    for (const row of savedStock) {
      await db.query(
        `INSERT INTO store_stock ("storeId", "cardIdentifier", "priceCents", quantity, "productUrl", "productNameRaw", "lastFetchedAt", "listedInStockAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [storeId, row['cardIdentifier'], row['priceCents'], row['quantity'], row['productUrl'], row['productNameRaw'], row['lastFetchedAt'], row['listedInStockAt']],
      );
    }
    if (createdStore) await db.query(`DELETE FROM store WHERE id = $1`, [storeId]);
    else await db.query(`UPDATE store SET "lastAvailabilityPassAt" = $2 WHERE id = $1`, [storeId, savedPassAt]);
    await fixture.close();
  });

  beforeEach(async () => {
    await fixture.dataSource.query(`DELETE FROM variant_fetch_job WHERE "cardIdentifier" = ANY($1)`, [CARDS]);
    await fixture.dataSource.query(`DELETE FROM store_stock WHERE "storeId" = $1 AND "cardIdentifier" = ANY($2)`, [storeId, CARDS]);
  });

  async function listCard(cardIdentifier: string, overrides: { priceCents?: number | null; quantity?: number; fetchedDaysAgo?: number } = {}): Promise<void> {
    const { priceCents = null, quantity = 0, fetchedDaysAgo = 0 } = overrides;
    await fixture.dataSource.query(
      `INSERT INTO store_stock ("storeId", "cardIdentifier", "priceCents", quantity, "productUrl", "productNameRaw", "lastFetchedAt", "listedInStockAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [storeId, cardIdentifier, priceCents, quantity, `https://www.cupuladt.com.br/?view=ecom/item&id=${cardIdentifier}`, cardIdentifier, new Date(Date.now() - fetchedDaysAgo * DAY_MS), passAt],
    );
  }

  async function pendingJobs(cardIdentifier: string): Promise<number> {
    const rows = await fixture.dataSource.query(
      `SELECT count(*)::int AS n FROM variant_fetch_job WHERE "cardIdentifier" = $1 AND status = 'pending'`,
      [cardIdentifier],
    );
    return rows[0].n;
  }

  async function linesOf(sessionToken: string, deckId: number): Promise<IMissingLine[]> {
    const response = await fixture.get(`/api/decks/${deckId}/missing`, sessionToken).expect(200);
    return response.body.lines as IMissingLine[];
  }

  it('two owners needing one card share a single pending lookup', async () => {
    await listCard(EMISSARY);
    const first = await fixture.scenario();
    const second = await fixture.scenario();

    const firstLines = await linesOf(first.sessionToken, first.deckId);
    const secondLines = await linesOf(second.sessionToken, second.deckId);

    expect(firstLines.find((line) => line.cardIdentifier === EMISSARY)).toMatchObject({ deckNeeded: 2, inventoryNeeded: 0, state: 'looking_up' });
    expect(secondLines.find((line) => line.cardIdentifier === EMISSARY)).toMatchObject({ state: 'looking_up' });
    expect(await pendingJobs(EMISSARY)).toBe(1);
  });

  it('opening the deck page queues no price lookup', async () => {
    await listCard(EMISSARY);
    const owner = await fixture.scenario();

    // The deck page's "Faltam N cartas" card asks for the stored prices only.
    const deckPage = await fixture.get(`/api/decks/${owner.deckId}/missing?lookups=read`, owner.sessionToken).expect(200);

    expect(deckPage.body.lines.find((line: IMissingLine) => line.cardIdentifier === EMISSARY)).toMatchObject({ deckNeeded: 2 });
    expect(await pendingJobs(EMISSARY)).toBe(0);

    // The owner's list page is the one that queues it.
    await linesOf(owner.sessionToken, owner.deckId);
    expect(await pendingJobs(EMISSARY)).toBe(1);

    await fixture.get(`/api/decks/${owner.deckId}/missing?lookups=nonsense`, owner.sessionToken).expect(400);
  });

  it('lookups=read answers the owner without queueing and refuses everyone else', async () => {
    await listCard(EMISSARY);
    const owner = await fixture.scenario();
    const stranger = await fixture.signUp('stranger');

    const answer = await fixture.get(`/api/decks/${owner.deckId}/missing?lookups=read`, owner.sessionToken).expect(200);
    const plain = await fixture.get(`/api/decks/${owner.deckId}/missing`, owner.sessionToken).expect(200);

    expect(Object.keys(answer.body).sort()).toEqual(Object.keys(plain.body).sort());
    expect(answer.body.lines.find((line: IMissingLine) => line.cardIdentifier === EMISSARY)).toMatchObject({ deckNeeded: 2 });
    // The plain request is the one that queues; the read request ran first and left nothing behind.
    expect(await pendingJobs(EMISSARY)).toBe(1);
    await fixture.dataSource.query(`DELETE FROM variant_fetch_job WHERE "cardIdentifier" = ANY($1)`, [CARDS]);
    await fixture.get(`/api/decks/${owner.deckId}/missing?lookups=read`, owner.sessionToken).expect(200);
    expect(await pendingJobs(EMISSARY)).toBe(0);

    await fixture.get(`/api/decks/${owner.deckId}/missing?lookups=read`, stranger.sessionToken).expect(404);
    await fixture.get(`/api/decks/${owner.deckId}/missing?lookups=nonsense`, owner.sessionToken).expect(400);
    await request(fixture.app.getHttpServer()).get(`/api/decks/${owner.deckId}/missing?lookups=read`).expect(401);

    await fixture.delete(`/api/decks/${owner.deckId}`, owner.sessionToken).expect(200);
    await fixture.get(`/api/decks/${owner.deckId}/missing?lookups=read`, owner.sessionToken).expect(404);
  });

  it('gives each card the state the store answers for it', async () => {
    await listCard(COAX, { priceCents: 3000, quantity: 4, fetchedDaysAgo: 3 });
    await listCard(ADRENALINE, { priceCents: 3000, quantity: 4, fetchedDaysAgo: 3 });
    await fixture.dataSource.query(`UPDATE store_stock SET "listedInStockAt" = $3 WHERE "storeId" = $1 AND "cardIdentifier" = $2`, [storeId, ADRENALINE, new Date(passAt.getTime() - 7 * DAY_MS)]);
    const owner = await fixture.scenario([
      { cardIdentifier: COAX, quantity: 1, slot: 'mainboard' },
      { cardIdentifier: ADRENALINE, quantity: 1, slot: 'mainboard' },
    ]);

    const lines = await linesOf(owner.sessionToken, owner.deckId);

    expect(lines.find((line) => line.cardIdentifier === COAX)?.state).toBe('priced');
    expect(lines.find((line) => line.cardIdentifier === ADRENALINE)?.state).toBe('store_lacks');
    expect(lines.find((line) => line.cardIdentifier === EMISSARY)?.state).toBe('not_on_site');
    expect(await pendingJobs(COAX)).toBe(0);
    expect(await pendingJobs(ADRENALINE)).toBe(0);
    expect(await pendingJobs(EMISSARY)).toBe(0);
  });

  it('counts the inventory copies apart from the deck copies', async () => {
    const owner = await fixture.scenario();
    await fixture.dataSource.query(
      `UPDATE deck_card SET "inventoryQuantity" = 1 WHERE "trackedDeckId" = $1 AND "cardIdentifier" = $2`,
      [owner.deckId, EMISSARY],
    );

    const lines = await linesOf(owner.sessionToken, owner.deckId);

    expect(lines.find((line) => line.cardIdentifier === EMISSARY)).toMatchObject({ deckNeeded: 2, inventoryNeeded: 1 });
  });

  it('returns the summary and lines to the owner and 404 to anyone else', async () => {
    await listCard(COAX, { priceCents: 3000, quantity: 4, fetchedDaysAgo: 3 });
    const owner = await fixture.scenario([{ cardIdentifier: COAX, quantity: 1, slot: 'mainboard' }]);
    const stranger = await fixture.signUp('stranger');

    const response = await fixture.get(`/api/decks/${owner.deckId}/missing`, owner.sessionToken).expect(200);

    expect(response.body.summary).toEqual({
      totalCopies: 7,
      buyCopies: 1,
      buyCents: 3000,
      lacksCopies: 0,
      notOnSiteCopies: 6,
      ownedCopies: 0,
      standInCopies: 0,
      lookingUp: 0,
      noPrice: 0,
      availabilityCheckedAt: passAt.toISOString(),
      priceValidDays: 30,
    });
    const coax = response.body.lines.find((line: { cardIdentifier: string }) => line.cardIdentifier === COAX);
    expect(coax).toMatchObject({ deckNeeded: 1, inventoryNeeded: 0, state: 'priced', unitPriceCents: 3000, lineCents: 3000 });
    await fixture.get(`/api/decks/${owner.deckId}/missing`, stranger.sessionToken).expect(404);
    await fixture.get('/api/decks/999999999/missing', owner.sessionToken).expect(404);
  });

  it('the fetch-variants route is gone', async () => {
    const owner = await fixture.scenario();

    await fixture.post(`/api/decks/${owner.deckId}/fetch-variants`, owner.sessionToken).expect(404);
    await fixture.get('/api/variant-jobs', owner.sessionToken).expect(404);
  });
});
