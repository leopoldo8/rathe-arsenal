import { catalog } from '@rathe-arsenal/engine';
import { runChatTool } from '../chat-tools';
import { ChatToolsService } from '../chat-tools.service';
import { bootChatFixture, COAX, EMISSARY, FLEX, IChatFixture, IChatUser, KATSU, TALISHAR } from './chat-e2e.fixture';

const RUNEBLADE_EMISSARY = 'aurora-emissary-of-lightning';

describe('chat tools (E2E)', () => {
  let fixture: IChatFixture;
  let tools: ChatToolsService;

  beforeAll(async () => {
    fixture = await bootChatFixture();
    tools = fixture.app.get(ChatToolsService);
  }, 60_000);

  afterAll(async () => {
    await fixture.dataSource.query(`DELETE FROM tournament_deck WHERE "fabraryUlid" LIKE '01TOOLS%'`);
    await fixture.close();
  });

  function toolboxFor(user: IChatUser) {
    return tools.forTurn({ userId: user.userId, locale: 'en-US' }).toolbox;
  }

  it("tools only see the message owner's data", async () => {
    const owner = await fixture.chatUser();
    const other = await fixture.chatUser();
    await fixture.own(owner.jwt, [{ cardIdentifier: FLEX, quantity: 3 }]);
    await fixture.own(other.jwt, [{ cardIdentifier: FLEX, quantity: 1 }]);
    const toolbox = toolboxFor(owner);

    expect(await runChatTool(toolbox, 'get_deck', { deckId: other.deckId })).toEqual({ error: 'DECK_NOT_FOUND' });
    expect(await runChatTool(toolbox, 'get_recommendations', { deckId: other.deckId })).toEqual({ error: 'DECK_NOT_FOUND' });
    expect(await runChatTool(toolbox, 'get_owned_copies', { cardIdentifiers: [FLEX] })).toEqual({ owned: { [FLEX]: 3 } });
    expect(
      await runChatTool(toolbox, 'propose_swap', {
        deckId: other.deckId,
        originalCardIdentifier: FLEX,
        slot: 'mainboard',
        replacementCardIdentifier: COAX,
        reason: 'x',
      }),
    ).toEqual(expect.objectContaining({ ok: false, error: 'DECK_NOT_FOUND' }));
  });

  it('each read tool answers from the database', async () => {
    const user = await fixture.chatUser();
    await fixture.own(user.jwt, [{ cardIdentifier: EMISSARY, quantity: 1 }]);
    const toolbox = toolboxFor(user);
    const [{ id: runId }] = (await fixture.dataSource.query(
      `INSERT INTO recommendation_run ("trackedDeckId", "trigger", status, "runAfter", "deckFingerprint", "finishedAt") VALUES ($1, 'manual', 'done', now(), 'x', now()) RETURNING id`,
      [user.deckId],
    )) as [{ id: string }];
    await fixture.dataSource.query(
      `INSERT INTO recommendation ("runId", "cardIdentifier", rank, strength, reason, "cutCardIdentifier", "cutSlot") VALUES ($1, $2, 1, 'clear_upgrade', 'more value', $3, 'mainboard')`,
      [runId, COAX, FLEX],
    );
    const insertDeck = `INSERT INTO tournament_deck ("fabraryUlid", name, "eventName", placement, "heroIdentifier", format, "deckCreatedAt", "syncedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, now()) RETURNING id`;
    const [{ id: newer }] = (await fixture.dataSource.query(insertDeck, ['01TOOLS0000000000000000001', 'Calling: Pelotas 1st', 'Calling: Pelotas', 1, KATSU, 'Classic Constructed', '2026-09-01T00:00:00Z'])) as [{ id: string }];
    await fixture.dataSource.query(insertDeck, ['01TOOLS0000000000000000002', 'Calling: Rio 3rd', 'Calling: Rio', 3, KATSU, 'Classic Constructed', '2026-06-01T00:00:00Z']);
    await fixture.dataSource.query(insertDeck, ['01TOOLS0000000000000000003', 'Blitz brew', null, null, KATSU, 'Blitz', '2026-09-02T00:00:00Z']);
    await fixture.dataSource.query(
      `INSERT INTO tournament_deck_card ("tournamentDeckId", "cardIdentifier", quantity, "sideboardQuantity") VALUES ($1, $2, 3, 0), ($1, $3, 1, 0)`,
      [newer, FLEX, TALISHAR],
    );

    const deck = await runChatTool(toolbox, 'get_deck', { deckId: user.deckId });
    const search = await runChatTool(toolbox, 'search_cards', { query: 'emissary', heroIdentifier: KATSU, format: 'Classic Constructed', limit: 20 });
    const recommendations = await runChatTool(toolbox, 'get_recommendations', { deckId: user.deckId });
    const decks = await runChatTool(toolbox, 'search_tournament_decks', { heroIdentifier: KATSU, format: 'Classic Constructed' });
    const tournament = await runChatTool(toolbox, 'get_tournament_deck', { id: newer });

    expect(deck['cards']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cardIdentifier: EMISSARY, slot: 'mainboard', quantity: 2, owned: 1 }),
        expect.objectContaining({ cardIdentifier: TALISHAR, slot: 'weapon', quantity: 1, owned: 0 }),
      ]),
    );
    const cards = search['cards'] as Array<{ cardIdentifier: string; legal: boolean }>;
    expect(cards.find((card) => card.cardIdentifier === EMISSARY)?.legal).toBe(true);
    expect(catalog.getCard(RUNEBLADE_EMISSARY).classes).toEqual(['Runeblade']);
    expect(cards.find((card) => card.cardIdentifier === RUNEBLADE_EMISSARY)?.legal).toBe(false);
    expect(recommendations['recommendations']).toEqual([expect.objectContaining({ cardIdentifier: COAX, strength: 'clear_upgrade', cut: FLEX })]);
    expect((decks['decks'] as Array<{ name: string; source: string }>).map((row) => [row.name, row.source])).toEqual([
      ['Calling: Pelotas 1st', 'tournament'],
      ['Calling: Rio 3rd', 'tournament'],
    ]);
    expect(tournament['cards']).toEqual([
      expect.objectContaining({ cardIdentifier: FLEX, quantity: 3, slot: 'mainboard' }),
      expect.objectContaining({ cardIdentifier: TALISHAR, quantity: 1, slot: 'weapon' }),
    ]);
  });

  it('an empty tournament search says so and names related heroes and the heroes with decks', async () => {
    const user = await fixture.chatUser();
    const toolbox = toolboxFor(user);
    const insertDeck = `INSERT INTO tournament_deck ("fabraryUlid", name, "eventName", placement, "heroIdentifier", format, "deckCreatedAt", "syncedAt", source)
      VALUES ($1, $2, null, null, $3, $4, now(), now(), $5)`;
    await fixture.dataSource.query(insertDeck, ['01TOOLS0000000000000000011', 'Calling: Lyon 2nd', 'azalea-ace-in-the-hole', 'Classic Constructed', 'tournament']);
    await fixture.dataSource.query(insertDeck, ['01TOOLS0000000000000000012', 'Skirmish 9 Winner', 'kano', 'Silver Age', 'player-named']);
    await fixture.dataSource.query(insertDeck, ['01TOOLS0000000000000000013', 'Skirmish 9 2nd', 'kano', 'Silver Age', 'player-named']);

    const empty = await runChatTool(toolbox, 'search_tournament_decks', { heroIdentifier: 'azalea', format: 'Silver Age' });
    const found = await runChatTool(toolbox, 'search_tournament_decks', { heroIdentifier: 'kano', format: 'Silver Age' });

    expect(empty['decks']).toEqual([]);
    expect(empty['note']).toEqual(expect.stringContaining('No tournament deck matches'));
    expect(empty['relatedHeroes']).toEqual([{ heroIdentifier: 'azalea-ace-in-the-hole', format: 'Classic Constructed', decks: 1 }]);
    expect(empty['heroesWithDecks']).toEqual([{ heroIdentifier: 'kano', format: 'Silver Age', decks: 2 }]);
    expect((found['decks'] as Array<{ source: string }>).map((deck) => deck.source)).toEqual(['player-named', 'player-named']);
    expect(found['note']).toBeUndefined();
  });

  it('get_deck and get_tournament_deck carry the counted totals, card text and the deck source', async () => {
    const user = await fixture.chatUser();
    const toolbox = toolboxFor(user);
    const [{ id }] = (await fixture.dataSource.query(
      `INSERT INTO tournament_deck ("fabraryUlid", name, "eventName", placement, "heroIdentifier", format, "deckCreatedAt", "syncedAt", source)
       VALUES ('01TOOLS0000000000000000021', 'Skirmish 3 Winner', null, null, $1, 'Blitz', '2026-05-01T00:00:00Z', now(), 'player-named') RETURNING id`,
      [KATSU],
    )) as [{ id: string }];
    await fixture.dataSource.query(
      `INSERT INTO tournament_deck_card ("tournamentDeckId", "cardIdentifier", quantity, "sideboardQuantity") VALUES ($1, $2, 2, 0), ($1, $3, 1, 0)`,
      [id, FLEX, TALISHAR],
    );

    const deck = await runChatTool(toolbox, 'get_deck', { deckId: user.deckId });
    const tournament = await runChatTool(toolbox, 'get_tournament_deck', { id });

    expect(deck['totals']).toEqual(expect.objectContaining({ bySlot: expect.any(Object), mainboardByPitch: expect.any(Object), cardPool: expect.any(Number) }));
    expect(deck['cards']).toEqual(expect.arrayContaining([expect.objectContaining({ cardIdentifier: FLEX, text: expect.any(String), owned: expect.any(Number) })]));
    expect(tournament).toEqual(expect.objectContaining({ source: 'player-named', format: 'Blitz' }));
    expect(tournament['totals']).toEqual(expect.objectContaining({ bySlot: { weapon: 1, mainboard: 2 }, cardPool: 3 }));
  });

  it('get_tournament_meta counts decks, top 8s and wins per hero for a format', async () => {
    const user = await fixture.chatUser();
    const toolbox = toolboxFor(user);
    const insert = `INSERT INTO tournament_deck ("fabraryUlid", name, "eventName", placement, "heroIdentifier", format, "deckCreatedAt", "syncedAt", source)
      VALUES ($1, 'x', null, $2, $3, 'Living Legend', $4, now(), $5)`;
    await fixture.dataSource.query(insert, ['01TOOLS0000000000000000031', 1, 'kano-dracai-of-aether', '2026-08-01T00:00:00Z', 'tournament']);
    await fixture.dataSource.query(insert, ['01TOOLS0000000000000000032', 12, 'kano-dracai-of-aether', '2026-08-02T00:00:00Z', 'tournament']);
    await fixture.dataSource.query(insert, ['01TOOLS0000000000000000033', 3, 'dorinthea-ironsong', '2026-08-03T00:00:00Z', 'tournament']);
    await fixture.dataSource.query(insert, ['01TOOLS0000000000000000034', 1, 'dorinthea-ironsong', '2026-08-04T00:00:00Z', 'player-named']);
    await fixture.dataSource.query(insert, ['01TOOLS0000000000000000035', 1, 'dorinthea-ironsong', '2025-01-01T00:00:00Z', 'tournament']);

    const meta = await runChatTool(toolbox, 'get_tournament_meta', { format: 'Living Legend', since: '2026-01-01' });

    expect(meta['heroes']).toEqual([
      { heroIdentifier: 'kano-dracai-of-aether', decks: 2, top8: 1, wins: 1, playerNamed: 0, latest: expect.anything() },
      { heroIdentifier: 'dorinthea-ironsong', decks: 1, top8: 1, wins: 0, playerNamed: 1, latest: expect.anything() },
    ]);
    expect(meta['decks']).toBe(3);
  });
});
