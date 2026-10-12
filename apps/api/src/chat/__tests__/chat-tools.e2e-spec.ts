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
    expect((decks['decks'] as Array<{ name: string }>).map((row) => row.name)).toEqual(['Calling: Pelotas 1st', 'Calling: Rio 3rd']);
    expect(tournament['cards']).toEqual([
      expect.objectContaining({ cardIdentifier: FLEX, quantity: 3, slot: 'mainboard' }),
      expect.objectContaining({ cardIdentifier: TALISHAR, quantity: 1, slot: 'weapon' }),
    ]);
  });
});
