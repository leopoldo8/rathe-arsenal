import request from 'supertest';
import { RecommendationQueueService } from '../../recommendations/recommendation-queue.service';
import { VariantFetchQueueService } from '../../stores/variant-fetch-queue.service';
import { ChatRunnerService } from '../../chat/chat-runner.service';
import { ChatToolsService } from '../../chat/chat-tools.service';
import { runChatTool } from '../../chat/chat-tools';
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

  async function userIdOf(email: string): Promise<string> {
    const rows = await fixture.dataSource.query(`SELECT id FROM "user" WHERE email = $1`, [email]);
    return rows[0].id;
  }

  async function deletedAtOf(deckId: number): Promise<Date | null> {
    return (await deckRow(deckId))?.['deletedAt'] as Date | null;
  }

  async function addTag(deckId: number, userId: string, name: string): Promise<void> {
    const [{ id }] = await fixture.dataSource.query(
      `INSERT INTO deck_tag ("userId", name) VALUES ($1, $2) RETURNING id`,
      [userId, name],
    );
    await fixture.dataSource.query(`INSERT INTO tracked_deck_tag ("trackedDeckId", "tagId") VALUES ($1, $2)`, [deckId, id]);
  }

  async function shareDeck(sessionToken: string, deckId: number, intent: 'deck' | 'missing'): Promise<string> {
    await fixture.dataSource.query(`UPDATE "user" SET "displayName" = 'Dono', "emailVerifiedAt" = now() WHERE id = (SELECT "userId" FROM tracked_deck WHERE id = $1)`, [deckId]);
    const response = await fixture.post(`/api/decks/${deckId}/share`, sessionToken).send({ intent }).expect(201);
    return response.body.token as string;
  }

  describe('delete', () => {
    it('delete sets deletedAt and hides the deck', async () => {
      const { sessionToken, deckId } = await ownerWithInventoryDeck();
      const token = await shareDeck(sessionToken, deckId, 'deck');
      const before = await storedLines(deckId);
      const before404 = await fixture.get('/api/decks', sessionToken).expect(200);
      expect(before404.body.trackedDecks.map((deck: { id: number }) => deck.id)).toContain(deckId);

      const started = Date.now();
      const response = await fixture.delete(`/api/decks/${deckId}`, sessionToken).expect(200);

      expect(Math.abs(new Date(response.body.deletedAt as string).getTime() - started)).toBeLessThan(10_000);
      expect(await deletedAtOf(deckId)).not.toBeNull();
      expect(await storedLines(deckId)).toEqual(before);
      const links = await fixture.dataSource.query(`SELECT 1 FROM share_link WHERE token = $1`, [token]);
      expect(links).toHaveLength(1);
      const list = await fixture.get('/api/decks', sessionToken).expect(200);
      expect(list.body.trackedDecks.map((deck: { id: number }) => deck.id)).not.toContain(deckId);
      await fixture.get(`/api/decks/${deckId}`, sessionToken).expect(404);
    });

    it('delete answers 404 for a deck the player cannot see', async () => {
      const owner = await ownerWithInventoryDeck();
      const { sessionToken: stranger } = await fixture.signUp('delete-stranger');
      await fixture.delete(`/api/decks/${owner.deckId}`, owner.sessionToken).expect(200);
      const deletedAt = await deletedAtOf(owner.deckId);
      const other = await ownerWithInventoryDeck();

      await fixture.delete(`/api/decks/${other.deckId}`, stranger).expect(404);
      await fixture.delete(`/api/decks/${owner.deckId}`, owner.sessionToken).expect(404);
      await fixture.delete(`/api/decks/2147483000`, owner.sessionToken).expect(404);

      expect(await deletedAtOf(other.deckId)).toBeNull();
      expect(await deletedAtOf(owner.deckId)).toEqual(deletedAt);
    });

    it('deleted decks are listed with their purge date', async () => {
      const owner = await ownerWithInventoryDeck();
      const second = await ownerWithInventoryDeck();
      const stranger = await fixture.signUp('list-stranger');
      const strangerDeck = await fixture.scenario();
      await fixture.delete(`/api/decks/${owner.deckId}`, owner.sessionToken).expect(200);
      await fixture.delete(`/api/decks/${strangerDeck.deckId}`, strangerDeck.sessionToken).expect(200);

      const response = await fixture.get('/api/decks/deleted', owner.sessionToken).expect(200);

      expect(response.body.decks).toHaveLength(1);
      const [item] = response.body.decks as Array<{ id: number; deletedAt: string; purgeAt: string; name: string }>;
      expect(item).toMatchObject({ id: owner.deckId, name: 'Rhinar CC' });
      const kept = new Date(item!.purgeAt).getTime() - new Date(item!.deletedAt).getTime();
      expect(kept).toBe(30 * 24 * 60 * 60 * 1000);
      expect(response.body.decks.map((deck: { id: number }) => deck.id)).not.toContain(second.deckId);
      expect(stranger.sessionToken).toBeDefined();
      const noSession = await fetchWithoutSession('/api/decks/deleted');
      expect(noSession).toBe(401);
    });

    it('restore brings back cards, inventory, replacements, tags and links', async () => {
      const { sessionToken, deckId, email } = await ownerWithInventoryDeck();
      const userId = await userIdOf(email);
      await addTag(deckId, userId, 'torneio');
      const token = await shareDeck(sessionToken, deckId, 'deck');
      await fixture.dataSource.query(
        `INSERT INTO card_replacement ("trackedDeckId", "userId", "originalCardIdentifier", "replacementCardIdentifier", slot, quantity, "pickedFrom", status)
         VALUES ($1, $3, $2, 'coax-a-commotion-red', 'mainboard', 1, 'search', 'active')`,
        [deckId, FLEX, userId],
      );
      const lines = await storedLines(deckId);
      const replacements = await fixture.replacementRows(deckId);
      await fixture.delete(`/api/decks/${deckId}`, sessionToken).expect(200);

      const restored = await fixture.post(`/api/decks/${deckId}/restore`, sessionToken).expect(200);

      expect(restored.body.id).toBe(deckId);
      expect(restored.body.tags).toEqual(['torneio']);
      expect(await storedLines(deckId)).toEqual(lines);
      expect(await fixture.replacementRows(deckId)).toEqual(replacements);
      const list = await fixture.get('/api/decks', sessionToken).expect(200);
      expect(list.body.trackedDecks.map((deck: { id: number }) => deck.id)).toContain(deckId);
      expect(await deletedAtOf(deckId)).toBeNull();
      await getShared(token).expect(200);
    });

    it('restore answers 404 for a deck that is not the player\'s deleted deck', async () => {
      const owner = await ownerWithInventoryDeck();
      const other = await ownerWithInventoryDeck();
      await fixture.delete(`/api/decks/${other.deckId}`, other.sessionToken).expect(200);
      const deletedAt = await deletedAtOf(other.deckId);

      await fixture.post(`/api/decks/${owner.deckId}/restore`, owner.sessionToken).expect(404);
      await fixture.post(`/api/decks/${other.deckId}/restore`, owner.sessionToken).expect(404);
      await fixture.post(`/api/decks/2147483000/restore`, owner.sessionToken).expect(404);

      expect(await deletedAtOf(owner.deckId)).toBeNull();
      expect(await deletedAtOf(other.deckId)).toEqual(deletedAt);
    });

    it('permanent delete removes the deck with today\'s cascades', async () => {
      const { sessionToken, deckId, email } = await ownerWithInventoryDeck();
      const userId = await userIdOf(email);
      await addTag(deckId, userId, 'sumir');
      const token = await shareDeck(sessionToken, deckId, 'deck');
      await fixture.dataSource.query(
        `INSERT INTO card_replacement ("trackedDeckId", "userId", "originalCardIdentifier", "replacementCardIdentifier", slot, quantity, "pickedFrom", status)
         VALUES ($1, $3, $2, 'coax-a-commotion-red', 'mainboard', 1, 'search', 'active')`,
        [deckId, FLEX, userId],
      );
      const stranger = await fixture.signUp('permanent-stranger');
      await fixture.delete(`/api/decks/${deckId}`, sessionToken).expect(200);

      await fixture.delete(`/api/decks/${deckId}/permanent`, stranger.sessionToken).expect(404);
      expect(await deckRow(deckId)).toBeDefined();
      await fixture.delete(`/api/decks/2147483000/permanent`, sessionToken).expect(404);
      await fixture.delete(`/api/decks/${deckId}/permanent`, sessionToken).expect(204);

      expect(await deckRow(deckId)).toBeUndefined();
      expect(await storedLines(deckId)).toEqual([]);
      expect(await fixture.replacementRows(deckId)).toEqual([]);
      expect(await fixture.dataSource.query(`SELECT 1 FROM tracked_deck_tag WHERE "trackedDeckId" = $1`, [deckId])).toEqual([]);
      expect(await fixture.dataSource.query(`SELECT 1 FROM share_link WHERE token = $1`, [token])).toEqual([]);
    });

    it('permanent delete drops a live deck with no cards', async () => {
      const { sessionToken } = await fixture.signUp('permanent-empty');
      const created = await fixture.post('/api/decks', sessionToken).send({ heroIdentifier: 'rhinar', format: 'Blitz' }).expect(201);
      const deckId = created.body.id as number;

      await fixture.delete(`/api/decks/${deckId}/permanent`, sessionToken).expect(204);

      expect(await deckRow(deckId)).toBeUndefined();
      const deleted = await fixture.get('/api/decks/deleted', sessionToken).expect(200);
      expect(deleted.body.decks).toEqual([]);
    });

    it('a deleted deck is left out of every reader', async () => {
      const owner = await fixture.signUp('readers');
      const userId = await userIdOf(owner.email);
      const make = async (): Promise<number> => {
        const created = await fixture.post('/api/decks', owner.sessionToken).send({ heroIdentifier: 'rhinar', format: 'Blitz' }).expect(201);
        await fixture
          .put(`/api/decks/${created.body.id}`, owner.sessionToken)
          .send({ heroIdentifier: 'rhinar', format: 'Blitz', cards: [{ cardIdentifier: 'pack-hunt-red', quantity: 1, slot: 'mainboard' }] })
          .expect(200);
        await fixture.get(`/api/decks/${created.body.id}`, owner.sessionToken).expect(200);
        return created.body.id as number;
      };
      const gone = await make();
      const kept = await make();
      const storeId = await anyStoreId();
      // The save above queued an automatic run; make it due now.
      await fixture.dataSource.query(
        `UPDATE recommendation_run SET "runAfter" = now() - interval '1 minute' WHERE "trackedDeckId" = $1 AND status = 'pending'`,
        [gone],
      );
      await fixture.dataSource.query(`INSERT INTO variant_fetch_job ("userId", "deckId", "storeId", status, "enqueuedAt") VALUES ($1, $2, $3, 'pending', now() - interval '1 year')`, [userId, gone, storeId]);
      await fixture.delete(`/api/decks/${gone}`, owner.sessionToken).expect(200);
      const goneSnapshots = await fixture.snapshotCount(gone);
      const keptSnapshots = await fixture.snapshotCount(kept);

      await fixture.own(owner.sessionToken, [{ cardIdentifier: 'pack-hunt-red', quantity: 1 }]);
      expect(await fixture.snapshotCount(gone)).toBe(goneSnapshots);
      expect(await fixture.snapshotCount(kept)).toBeGreaterThan(keptSnapshots);

      const list = await fixture.get('/api/decks', owner.sessionToken).expect(200);
      expect(list.body.trackedDecks.map((deck: { id: number }) => deck.id)).toEqual([kept]);

      const runner = fixture.app.get(ChatRunnerService) as unknown as { deckSummaries(userId: string): Promise<Array<{ id: number }>> };
      expect((await runner.deckSummaries(userId)).map((deck) => deck.id)).toEqual([kept]);
      const toolbox = fixture.app.get(ChatToolsService).forTurn({ userId, locale: 'en-US' }).toolbox;
      expect(await runChatTool(toolbox, 'get_deck', { deckId: gone })).toEqual({ error: 'DECK_NOT_FOUND' });
      expect(await runChatTool(toolbox, 'get_deck', { deckId: kept })).not.toEqual({ error: 'DECK_NOT_FOUND' });

      const queue = fixture.app.get(RecommendationQueueService);
      const runsOf = (deckId: number): Promise<unknown[]> =>
        fixture.dataSource.query(`SELECT id, "runAfter" FROM recommendation_run WHERE "trackedDeckId" = $1 ORDER BY id`, [deckId]);
      const runsBefore = await runsOf(gone);
      await fixture.dataSource.transaction((manager) => queue.enqueueAuto(manager, gone));
      expect(await runsOf(gone)).toEqual(runsBefore);
      const claimedRun = await queue.claimNext();
      if (claimedRun) await fixture.dataSource.query(`UPDATE recommendation_run SET status = 'pending', "claimedAt" = NULL WHERE id = $1`, [claimedRun.id]);
      expect(claimedRun?.trackedDeckId).not.toBe(gone);

      const claimedJob = await fixture.app.get(VariantFetchQueueService).claimNext('lifecycle-test');
      if (claimedJob) await fixture.dataSource.query(`UPDATE variant_fetch_job SET status = 'pending', "claimedAt" = NULL, "claimedBy" = NULL WHERE id = $1`, [claimedJob.id]);
      expect(claimedJob?.deckId).not.toBe(gone);
    });
  });

  async function anyStoreId(): Promise<number> {
    const rows = await fixture.dataSource.query(`SELECT id FROM store ORDER BY id LIMIT 1`);
    return rows[0]?.id ?? 1;
  }

  function getShared(token: string) {
    return request(fixture.app.getHttpServer()).get(`/api/shared/decks/${token}`);
  }

  async function fetchWithoutSession(path: string): Promise<number> {
    const response = await request(fixture.app.getHttpServer()).get(path);
    return response.status;
  }
});
