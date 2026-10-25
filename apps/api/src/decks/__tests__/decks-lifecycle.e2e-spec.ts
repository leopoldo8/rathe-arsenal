import { bootFixture, EMISSARY, FLEX, IFixture, IScenario } from '../../replacements/__tests__/replacements-e2e.fixture';

interface IStoredLine {
  readonly cardIdentifier: string;
  readonly slot: string;
  readonly quantity: number;
  readonly inventoryQuantity: number;
}

describe('deck lifecycle (E2E)', () => {
  let fixture: IFixture;

  beforeAll(async () => {
    fixture = await bootFixture();
  });

  afterAll(async () => {
    await fixture.close();
  });

  async function storedLines(deckId: number): Promise<IStoredLine[]> {
    return fixture.dataSource.query(
      `SELECT "cardIdentifier", slot, quantity, "inventoryQuantity" FROM deck_card
        WHERE "trackedDeckId" = $1 ORDER BY "cardIdentifier", slot`,
      [deckId],
    );
  }

  async function deckRow(deckId: number): Promise<Record<string, unknown> | undefined> {
    const rows = await fixture.dataSource.query(`SELECT * FROM tracked_deck WHERE id = $1`, [deckId]);
    return rows[0];
  }

  async function deckCountFor(email: string): Promise<number> {
    const rows = await fixture.dataSource.query(
      `SELECT count(*)::int AS n FROM tracked_deck d JOIN "user" u ON u.id = d."userId" WHERE u.email = $1`,
      [email],
    );
    return rows[0].n;
  }

  async function ownerWithInventoryDeck(): Promise<IScenario> {
    const scenario = await fixture.scenario();
    await fixture.dataSource.query(`UPDATE tracked_deck SET name = 'Rhinar CC' WHERE id = $1`, [scenario.deckId]);
    await fixture.dataSource.query(
      `UPDATE deck_card SET "inventoryQuantity" = 1 WHERE "trackedDeckId" = $1 AND "cardIdentifier" = $2`,
      [scenario.deckId, EMISSARY],
    );
    return scenario;
  }

  describe('duplicate', () => {
    it('duplicate copies cards and inventory at stage idea', async () => {
      const { sessionToken, deckId } = await ownerWithInventoryDeck();
      const beforeLines = await storedLines(deckId);
      const beforeDeck = await deckRow(deckId);

      const response = await fixture.post(`/api/decks/${deckId}/duplicate`, sessionToken).expect(201);

      const newId = response.body.deckId as number;
      expect(newId).toEqual(expect.any(Number));
      expect(newId).not.toBe(deckId);
      const copy = await deckRow(newId);
      expect(copy).toMatchObject({ name: 'Rhinar CC (cópia)', status: 'idea', format: 'Classic Constructed' });
      expect(copy?.['fabraryUlid']).toBeNull();
      const copiedLines = await storedLines(newId);
      expect(copiedLines).toEqual(beforeLines);
      expect(copiedLines.find((line) => line.cardIdentifier === EMISSARY)).toMatchObject({
        quantity: 2,
        inventoryQuantity: 1,
      });
      expect(copiedLines.find((line) => line.cardIdentifier === FLEX)).toMatchObject({ quantity: 2, inventoryQuantity: 0 });
      expect(await storedLines(deckId)).toEqual(beforeLines);
      expect(await deckRow(deckId)).toEqual(beforeDeck);
      const opened = await fixture.get(`/api/decks/${newId}`, sessionToken).expect(200);
      expect(opened.body.name).toBe('Rhinar CC (cópia)');
    });

    it('duplicate answers 404 for a deck the player cannot see', async () => {
      const owner = await ownerWithInventoryDeck();
      const deleted = await ownerWithInventoryDeck();
      await fixture.dataSource.query(`UPDATE tracked_deck SET "deletedAt" = now() WHERE id = $1`, [deleted.deckId]);
      const { sessionToken: stranger, email: strangerEmail } = await fixture.signUp('duplicate-stranger');
      const ownerDecksBefore = await deckCountFor(owner.email);
      const deletedOwnerDecksBefore = await deckCountFor(deleted.email);

      await fixture.post(`/api/decks/${owner.deckId}/duplicate`, stranger).expect(404);
      await fixture.post(`/api/decks/${deleted.deckId}/duplicate`, deleted.sessionToken).expect(404);
      await fixture.post(`/api/decks/2147483000/duplicate`, owner.sessionToken).expect(404);

      expect(await deckCountFor(strangerEmail)).toBe(0);
      expect(await deckCountFor(owner.email)).toBe(ownerDecksBefore);
      expect(await deckCountFor(deleted.email)).toBe(deletedOwnerDecksBefore);
    });
  });
});
