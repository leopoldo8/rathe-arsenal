/**
 * The counts the 30-day reviews read from the logs: imports, pending lines, the owner's missing list, spare lists,
 * sales and the spare rule. Every entry carries kinds, counts and ids only. Needs DATABASE_URL like the other e2e specs.
 */
import { createMock } from '@golevelup/ts-jest';
import { Logger } from '@nestjs/common';
import request from 'supertest';
import { FabraryService } from '../fabrary/fabrary.service';
import { baseDeck } from '../replacements/__tests__/replacements-e2e.fixture';
import { ImportsFixture, IImportsUser } from '../collection/__tests__/imports-e2e.fixture';
import armoryKayo from '../products/data/armory-kayo.json';

const SNATCH = 'snatch-red';
const PUMMEL_YELLOW = 'pummel-yellow';
const FABRARY_ULID = '01HQ0000000000000000000000';
const STORE_STATES = ['priced', 'store_lacks', 'not_on_site', 'looking_up', 'no_price'] as const;

type TLogged = Record<string, unknown>;

describe('Review counts (E2E)', () => {
  let fixture: ImportsFixture;
  let player: IImportsUser;
  let logs: jest.SpyInstance;

  const server = (): ReturnType<ImportsFixture['app']['getHttpServer']> => fixture.app.getHttpServer();
  const asPlayer = (req: request.Test): request.Test => fixture.as(player, req);
  const logged = (event: string): TLogged[] =>
    logs.mock.calls.map(([entry]) => entry as TLogged).filter((entry) => typeof entry === 'object' && entry !== null && entry['event'] === event);

  beforeAll(async () => {
    const fabrary = createMock<FabraryService>();
    fabrary.fetchDeck.mockImplementation(async (ulid: string) => ({ ulid, ...baseDeck() }));
    fixture = await ImportsFixture.boot('review-counts', (builder) => builder.overrideProvider(FabraryService).useValue(fabrary));
    player = await fixture.signUp('player');
  }, 60_000);

  afterAll(async () => {
    await fixture.close();
  });

  beforeEach(async () => {
    await fixture.wipe(player);
    logs = jest.spyOn(Logger.prototype, 'log');
  });

  afterEach(() => {
    logs.mockRestore();
  });

  const pastedLines = {
    ready: [
      { cardIdentifier: SNATCH, quantity: 2 },
      { cardIdentifier: PUMMEL_YELLOW, quantity: 1 },
      { cardIdentifier: 'flex-red', quantity: 3 },
    ],
    pending: [
      { lineNumber: 4, originalText: '4 Pummel', reason: 'asks_color', suggestedCardIdentifier: PUMMEL_YELLOW },
      { lineNumber: 5, originalText: 'Mistery Card', reason: 'not_found' },
    ],
  };

  it('each import kind logs what it read', async () => {
    // Arrange
    const kinds = ['csv', 'paste', 'manual'] as const;

    // Act and Assert: the three kinds that arrive as read lines
    for (const kind of kinds) {
      logs.mockClear();
      await asPlayer(request(server()).post('/api/collection/imports').send({ kind, name: `Lista ${kind}`, ...pastedLines })).expect(201);
      expect(logged('import.finished')).toEqual([
        expect.objectContaining({ event: 'import.finished', kind, linesRead: 5, ready: 3, asked: 1, kept: 1 }),
      ]);
      expect(logged('import.finished')[0]).not.toHaveProperty('productKey');
      expect(logged('import.finished')[0]).not.toHaveProperty('ownership');
    }

    // Act and Assert: a ready-made deck names its product
    logs.mockClear();
    await asPlayer(request(server()).post('/api/products/armory-kayo/import').send({ addCards: true, createDeck: false })).expect(201);
    const cardsInFile = armoryKayo.cards.length;
    expect(logged('import.finished')).toEqual([
      expect.objectContaining({ kind: 'product', productKey: 'armory-kayo', linesRead: cardsInFile, ready: cardsInFile, asked: 0, kept: 0 }),
    ]);

    // Act and Assert: a Fabrary deck records the ownership answer given
    logs.mockClear();
    const owned = await asPlayer(request(server()).post('/api/decks/import').send({ text: `https://fabrary.net/decks/${FABRARY_ULID}`, ownsCards: true })).expect(201);
    expect(logged('import.finished')).toEqual([
      expect.objectContaining({ kind: 'fabrary', ownership: true, linesRead: owned.body.source.cardCount, asked: 0, kept: 0 }),
    ]);
    logs.mockClear();
    await fixture.dataSource.query(`DELETE FROM tracked_deck WHERE "userId" = $1`, [player.id]);
    await asPlayer(request(server()).post('/api/decks/import').send({ text: `https://fabrary.net/decks/${FABRARY_ULID}`, ownsCards: false })).expect(201);
    expect(logged('import.finished')).toEqual([expect.objectContaining({ kind: 'fabrary', ownership: false })]);
  });

  it('an import that fails writes no finished entry', async () => {
    await asPlayer(request(server()).post('/api/collection/imports').send({ kind: 'paste', name: 'Vazia', ready: [], pending: [] })).expect(400);
    expect(logged('import.finished')).toEqual([]);
  });

  it('a resolved or deleted pending line is logged', async () => {
    // Arrange
    const created = await asPlayer(request(server()).post('/api/collection/imports').send({ kind: 'paste', name: 'Lista colada', ...pastedLines })).expect(201);
    const sourceId = created.body.source.id as string;
    const pending = await asPlayer(request(server()).get('/api/collection/pending')).expect(200);
    const [first, second] = pending.body.imports[0].lines as Array<{ id: number }>;

    // Act
    await asPlayer(request(server()).patch(`/api/collection/pending/${first!.id}`).send({ cardIdentifier: PUMMEL_YELLOW, quantity: 1 })).expect(200);
    await asPlayer(request(server()).delete(`/api/collection/pending/${second!.id}`)).expect(204);
    await asPlayer(request(server()).delete(`/api/collection/pending/${second!.id}`)).expect(404);

    // Assert
    expect(logged('import.pending_line')).toEqual([
      expect.objectContaining({ event: 'import.pending_line', sourceId, action: 'resolved' }),
      expect.objectContaining({ event: 'import.pending_line', sourceId, action: 'deleted' }),
    ]);
  });

  it("the owner's missing list logs copies per store state", async () => {
    // Arrange
    const imported = await asPlayer(request(server()).post('/api/decks/import').send({ text: `https://fabrary.net/decks/${FABRARY_ULID}`, ownsCards: false })).expect(201);
    const deckId = imported.body.deckId as number;
    logs.mockClear();

    // Act
    const served = await asPlayer(request(server()).get(`/api/decks/${deckId}/missing`)).expect(200);

    // Assert
    const lines = served.body.lines as Array<{ state: string; deckNeeded: number; inventoryNeeded: number }>;
    const copiesIn = (state: string): number =>
      lines.filter((line) => line.state === state).reduce((sum, line) => sum + line.deckNeeded + line.inventoryNeeded, 0);
    const entries = logged('missing.served');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toEqual({
      event: 'missing.served',
      deckId,
      copies: Object.fromEntries(STORE_STATES.map((state) => [state, copiesIn(state)])),
    });
    expect(Object.values(entries[0]!['copies'] as Record<string, number>).reduce((sum, copies) => sum + copies, 0)).toBeGreaterThan(0);
  });

  it('spare lists, sold lines and the spare rule are logged', async () => {
    // Arrange
    await asPlayer(
      request(server()).post('/api/collection/imports').send({ kind: 'manual', name: 'Manual', ready: [{ cardIdentifier: SNATCH, quantity: 2 }], pending: [] }),
    ).expect(201);

    // Act: a list made from "Sobrando" and one made by hand
    const fromSpare = await asPlayer(request(server()).post('/api/lists').send({ kind: 'sell', name: 'Sobrando', origin: 'spare' })).expect(201);
    await asPlayer(request(server()).post('/api/lists').send({ kind: 'sell', name: 'Do zero' })).expect(201);
    await asPlayer(request(server()).post('/api/lists').send({ kind: 'sell', name: 'Errada', origin: 'elsewhere' })).expect(400);

    // Assert
    expect(logged('lists.created').filter((entry) => entry['origin'] === 'spare')).toEqual([
      expect.objectContaining({ event: 'lists.created', kind: 'sell', listId: fromSpare.body.id, origin: 'spare' }),
    ]);
    expect(logged('lists.created')).toHaveLength(1);

    // Act: one sale that takes the copy out of the collection and one that does not
    const listId = fromSpare.body.id as number;
    const added = await asPlayer(request(server()).post(`/api/lists/${listId}/lines`).send({ cardIdentifier: SNATCH, quantity: 1 })).expect(201);
    const withdrawnLine = (added.body.lines as Array<{ id: number }>)[0]!.id;
    const kept = await asPlayer(request(server()).post(`/api/lists/${listId}/lines`).send({ cardIdentifier: PUMMEL_YELLOW, quantity: 1 })).expect(201);
    const keptLine = (kept.body.lines as Array<{ id: number; cardIdentifier: string }>).find((line) => line.cardIdentifier === PUMMEL_YELLOW)!.id;
    await asPlayer(request(server()).post(`/api/lists/${listId}/lines/${withdrawnLine}/sold`).send({ quantity: 1, removeFromCollection: true })).expect(200);
    await asPlayer(request(server()).post(`/api/lists/${listId}/lines/${keptLine}/sold`).send({ quantity: 1, removeFromCollection: false })).expect(200);

    // Assert
    expect(logged('lists.line.sold')).toEqual([
      expect.objectContaining({ listId, lineId: withdrawnLine, removeFromCollection: true, removedFromCollection: 1 }),
      expect.objectContaining({ listId, lineId: keptLine, removeFromCollection: false, removedFromCollection: 0 }),
    ]);

    // Act: the rule set, then changed
    await asPlayer(request(server()).put('/api/users/me/spare-rule').send({ rule: 'any_deck' })).expect(200);
    await asPlayer(request(server()).put('/api/users/me/spare-rule').send({ rule: 'per_deck' })).expect(200);

    // Assert
    expect(logged('spare.rule.set')).toEqual([
      expect.objectContaining({ rule: 'any_deck', firstAnswer: true }),
      expect.objectContaining({ rule: 'per_deck', firstAnswer: false }),
    ]);
  });

  it('no entry carries an e-mail address, a name or text the player typed', async () => {
    await asPlayer(request(server()).post('/api/collection/imports').send({ kind: 'paste', name: 'Lista de Lucas', ...pastedLines })).expect(201);
    const pending = await asPlayer(request(server()).get('/api/collection/pending')).expect(200);
    await asPlayer(request(server()).delete(`/api/collection/pending/${pending.body.imports[0].lines[0].id as number}`)).expect(204);

    const text = JSON.stringify([...logged('import.finished'), ...logged('import.pending_line')]);

    expect(text).not.toMatch(/@test\.local/);
    expect(text).not.toContain('Lista de Lucas');
    expect(text).not.toContain('Mistery Card');
  });
});
