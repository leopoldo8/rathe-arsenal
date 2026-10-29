import { catalog, computeDeckLegality, findCardLegalityViolation, getCopyLimit } from '@rathe-arsenal/engine';
import { SpareCopiesService } from '../../collection/spare/spare-copies.service';
import { BATCH_CARD_LIMIT, BATCH_RULE_LIMIT, runChatTool } from '../chat-tools';
import { ChatToolsService } from '../chat-tools.service';
import { FabraryService } from '../../fabrary/fabrary.service';
import { FabraryIndexClient, IIndexRequest, IIndexResult } from '../../reference/fabrary-index';
import { slotOf } from '../proposal-validation';
import { printingsOfCard } from '../../lists/printing-key';
import { priceKeysOf } from '../../prices/price-suggestion';
import { bootChatFixture, COAX, EMISSARY, FLEX, IChatFixture, IChatUser, KATSU, TALISHAR } from './chat-e2e.fixture';

const RUNEBLADE_EMISSARY = 'aurora-emissary-of-lightning';
const EMISSARY_OF_WIND = 'emissary-of-wind-red';

describe('chat tools (E2E)', () => {
  let fixture: IChatFixture;
  let tools: ChatToolsService;

  beforeAll(async () => {
    fixture = await bootChatFixture();
    tools = fixture.app.get(ChatToolsService);
  }, 60_000);

  afterAll(async () => {
    await fixture.dataSource.query(`DELETE FROM tournament_deck WHERE "fabraryUlid" LIKE '01TOOLS%'`);
    await fixture.dataSource.query(`DELETE FROM rules_entry WHERE "ruleNumber" LIKE 'tools-%'`);
    await fixture.close();
  });

  function toolboxFor(user: IChatUser) {
    return tools.forTurn({ userId: user.userId, locale: 'en-US' }).toolbox;
  }

  interface IDeckLine {
    readonly cardIdentifier: string;
    readonly slot: 'hero' | 'weapon' | 'mainboard';
    readonly quantity: number;
    readonly inventoryQuantity?: number;
  }

  const RHINAR = 'rhinar-reckless-rampage';
  const PACK_HUNT_RED = 'pack-hunt-red';
  const PACK_HUNT_YELLOW = 'pack-hunt-yellow';
  const PACK_HUNT_BLUE = 'pack-hunt-blue';

  /** A deck of the user's own, inserted straight into the tables so a test can pick the status, hero and every quantity. */
  async function insertDeck(user: IChatUser, status: string, lines: readonly IDeckLine[], name = 'Rhinar CC'): Promise<number> {
    const [{ id }] = (await fixture.dataSource.query(
      `INSERT INTO tracked_deck ("userId", name, hero, "heroIdentifier", format, status)
       VALUES ($1, $2, 'Rhinar, Reckless Rampage', $3, 'Classic Constructed', $4) RETURNING id`,
      [user.userId, name, RHINAR, status],
    )) as [{ id: number }];
    for (const line of lines) {
      await fixture.dataSource.query(
        `INSERT INTO deck_card ("trackedDeckId", "cardIdentifier", quantity, "inventoryQuantity", slot) VALUES ($1, $2, $3, $4, $5)`,
        [id, line.cardIdentifier, line.quantity, line.inventoryQuantity ?? 0, line.slot],
      );
    }
    return id;
  }

  const PACK_HUNT_DECK: readonly IDeckLine[] = [
    { cardIdentifier: RHINAR, slot: 'hero', quantity: 1 },
    { cardIdentifier: PACK_HUNT_RED, slot: 'mainboard', quantity: 3, inventoryQuantity: 1 },
    { cardIdentifier: PACK_HUNT_YELLOW, slot: 'mainboard', quantity: 3 },
    { cardIdentifier: PACK_HUNT_BLUE, slot: 'mainboard', quantity: 3 },
  ];

  it("tools only see the message owner's data", async () => {
    const owner = await fixture.chatUser();
    const other = await fixture.chatUser();
    await fixture.own(owner.sessionToken, [{ cardIdentifier: FLEX, quantity: 3 }]);
    await fixture.own(other.sessionToken, [{ cardIdentifier: FLEX, quantity: 1 }]);
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
    await fixture.own(user.sessionToken, [{ cardIdentifier: EMISSARY, quantity: 1 }]);
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
    const batch = await runChatTool(toolbox, 'search_cards', { queries: ['emissary', 'talishar'], heroIdentifier: KATSU, format: 'Classic Constructed' });
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
    const batched = batch['results'] as Array<{ query: string; cards: Array<{ cardIdentifier: string; legal: boolean }> }>;
    // A phrase from the rules text of a card, found nowhere in its name, still finds the card.
    const byRulesText = await runChatTool(toolbox, 'search_cards', { query: 'banish it, then shuffle', limit: 20 });
    expect(catalog.getCard(KATSU).name.toLowerCase()).not.toContain('banish');
    expect(catalog.getCard(KATSU).functionalText).toContain('banish it, then shuffle');
    expect((byRulesText['cards'] as Array<{ cardIdentifier: string }>).map((card) => card.cardIdentifier)).toContain(KATSU);
    expect(batched.map((result) => result.query)).toEqual(['emissary', 'talishar']);
    expect(batched.every((result) => result.cards.length > 0 && result.cards.length <= BATCH_CARD_LIMIT)).toBe(true);
    expect(batched[1]!.cards.map((card) => card.cardIdentifier)).toContain(TALISHAR);
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
    expect(empty['note']).toEqual(expect.stringContaining('get_community_decks'));
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

    expect(deck['totals']).toEqual(
      expect.objectContaining({ bySlot: expect.any(Object), mainboardByPitch: expect.any(Object), mainboardByCost: expect.any(Object), cardPool: expect.any(Number) }),
    );
    expect(deck['cards']).toEqual(
      expect.arrayContaining([expect.objectContaining({ cardIdentifier: FLEX, text: expect.any(String), owned: expect.any(Number), cost: 0, power: 4, defense: 2 })]),
    );
    expect(tournament).toEqual(expect.objectContaining({ source: 'player-named', format: 'Blitz' }));
    expect(tournament['totals']).toEqual(expect.objectContaining({ bySlot: { weapon: 1, mainboard: 2 }, cardPool: 3 }));
  });

  it('propose_swap answers with how the swap changes role, cost, pitch, stats and the cost curve', async () => {
    const user = await fixture.chatUser();
    const toolbox = toolboxFor(user);

    const answer = await runChatTool(toolbox, 'propose_swap', {
      deckId: user.deckId,
      originalCardIdentifier: FLEX,
      slot: 'mainboard',
      replacementCardIdentifier: COAX,
      reason: 'same body',
    });

    expect(answer).toEqual({
      ok: true,
      quantity: 2,
      side: 'deck',
      comparison: expect.objectContaining({
        copies: 2,
        sameRole: true,
        costDelta: 0,
        pitchDelta: 0,
        powerDelta: 0,
        defenseDelta: 0,
        original: expect.objectContaining({ name: 'Flex', cost: 0 }),
        replacement: expect.objectContaining({ name: 'Coax a Commotion', cost: 0 }),
      }),
    });
    const comparison = answer['comparison'] as { mainboardByCostBefore: unknown; mainboardByCostAfter: unknown };
    expect(comparison.mainboardByCostAfter).toEqual(comparison.mainboardByCostBefore);
  });

  it("get_swap_candidates ranks cards for one of the deck's cards with cost, role and free copies", async () => {
    const owner = await fixture.chatUser();
    const other = await fixture.chatUser();
    await fixture.own(owner.sessionToken, [{ cardIdentifier: EMISSARY_OF_WIND, quantity: 1 }]);
    const toolbox = toolboxFor(owner);

    const found = await runChatTool(toolbox, 'get_swap_candidates', { deckId: owner.deckId, cardIdentifier: FLEX, slot: 'mainboard' });

    expect(found['copies']).toBe(2);
    const cards = (found['groups'] as Array<{ group: string; cards: Array<Record<string, unknown>> }>).flatMap((group) => group.cards);
    expect(cards.length).toBeGreaterThan(0);
    expect((found['groups'] as Array<{ group: string }>)[0]!.group).toBe('very_close');
    expect(cards.find((card) => card['cardIdentifier'] === EMISSARY_OF_WIND)).toEqual(
      expect.objectContaining({ cost: 0, costDelta: 0, sameRole: true, freeCopies: 1 }),
    );
    expect(cards.map((card) => card['cardIdentifier'])).not.toContain(FLEX);
    expect(await runChatTool(toolbox, 'get_swap_candidates', { deckId: owner.deckId, cardIdentifier: COAX, slot: 'mainboard' })).toEqual({
      error: 'CARD_NOT_IN_DECK',
    });
    expect(await runChatTool(toolbox, 'get_swap_candidates', { deckId: other.deckId, cardIdentifier: FLEX, slot: 'mainboard' })).toEqual({
      error: 'DECK_NOT_FOUND',
    });
  });

  it("get_draw_odds opens with the deck hero's intellect and counts the mainboard copies that match", async () => {
    const owner = await fixture.chatUser();
    const other = await fixture.chatUser();
    const toolbox = toolboxFor(owner);
    const rows = (await fixture.dataSource.query(`SELECT "cardIdentifier", slot, quantity FROM deck_card WHERE "trackedDeckId" = $1`, [owner.deckId])) as Array<{
      cardIdentifier: string;
      slot: string;
      quantity: number;
    }>;
    const mainboard = rows.filter((row) => row.slot === 'mainboard');
    const red = mainboard.filter((row) => catalog.getCard(row.cardIdentifier).pitch === 1).reduce((sum, row) => sum + row.quantity, 0);

    const odds = await runChatTool(toolbox, 'get_draw_odds', { deckId: owner.deckId, pitch: 1 });

    expect(odds).toEqual(
      expect.objectContaining({
        heroIntellect: catalog.getCard(KATSU).intellect,
        deckSize: mainboard.reduce((sum, row) => sum + row.quantity, 0),
        matchingCopies: red,
        cardsSeen: catalog.getCard(KATSU).intellect,
        atLeast: 1,
      }),
    );
    expect(await runChatTool(toolbox, 'get_draw_odds', { deckId: owner.deckId, cardIdentifiers: [], pitch: 1, cardType: '', atLeast: 1, extraDraws: 0 })).toEqual(
      expect.objectContaining({ matchingCopies: red, filters: { pitch: 1 } }),
    );
    expect(await runChatTool(toolbox, 'get_draw_odds', { deckId: owner.deckId })).toEqual(expect.objectContaining({ error: 'INVALID_ARGUMENTS' }));
    expect(await runChatTool(toolbox, 'get_draw_odds', { deckId: other.deckId, pitch: 1 })).toEqual({ error: 'DECK_NOT_FOUND' });
  });

  it("get_prices gives the store price in reais and the TCGplayer price in dollars, for listed cards or a deck's missing cards", async () => {
    const owner = await fixture.chatUser();
    const other = await fixture.chatUser();
    const toolbox = toolboxFor(owner);
    await fixture.dataSource.query(
      `INSERT INTO store (slug, name, "baseUrl", "listingPath", "rateLimitMs", active)
       VALUES ('cupula-dt', 'Cúpula DT', 'https://www.cupuladt.com.br', '/?view=ecom/itens&tcg=8', 1500, true)
       ON CONFLICT (slug) DO NOTHING`,
    );
    await fixture.dataSource.query(
      `INSERT INTO store_stock ("storeId", "cardIdentifier", "priceCents", quantity, "productUrl", "productNameRaw", "lastFetchedAt")
       VALUES ((SELECT id FROM store WHERE slug = 'cupula-dt'), $1, 300, 5, 'https://www.cupuladt.com.br/produto/flex', 'Flex (Red)', '2026-10-18T10:00:00Z')
       ON CONFLICT ("storeId", "cardIdentifier") DO UPDATE SET "priceCents" = 300, quantity = 5, "productUrl" = EXCLUDED."productUrl", "lastFetchedAt" = EXCLUDED."lastFetchedAt"`,
      [FLEX],
    );
    await fixture.dataSource.query(`DELETE FROM store_stock WHERE "cardIdentifier" = $1`, [COAX]);
    const regular = (printingsOfCard(FLEX) ?? []).find((printing) => printing.foiling === null && priceKeysOf(printing) !== null)!;
    const [productId, subType] = priceKeysOf(regular)!.split(':');
    await fixture.dataSource.query(
      `INSERT INTO card_price ("productId", "subType", "marketPriceCents", "midPriceCents", "fetchedAt") VALUES ($1, $2, 25, 30, '2026-10-17T00:00:00Z')
       ON CONFLICT ("productId", "subType") DO UPDATE SET "marketPriceCents" = 25, "midPriceCents" = 30, "fetchedAt" = EXCLUDED."fetchedAt"`,
      [productId, subType],
    );

    const listed = await runChatTool(toolbox, 'get_prices', { cardIdentifiers: [FLEX, COAX] });

    expect(listed['store']).toEqual(expect.objectContaining({ name: 'Cúpula DT', currency: 'BRL' }));
    expect(listed['tcgplayer']).toEqual(expect.objectContaining({ currency: 'USD' }));
    const [flex, coax] = listed['cards'] as Array<Record<string, unknown>>;
    expect(flex).toEqual(
      expect.objectContaining({
        cardIdentifier: FLEX,
        quantity: 1,
        store: { unitPriceCents: 300, available: 1, lineCents: 300, productUrl: 'https://www.cupuladt.com.br/produto/flex' },
        tcgplayer: expect.objectContaining({ unitPriceCents: 25, lineCents: 25, approximate: false, fetchedAt: '2026-10-17T00:00:00.000Z' }),
      }),
    );
    expect(coax).toEqual(expect.objectContaining({ cardIdentifier: COAX, store: null }));

    await fixture.dataSource.query(
      `INSERT INTO deck_readiness_snapshot ("trackedDeckId", "rawPercent", "effectivePercent", breakdown, substitutions) VALUES ($1, 50, 50, $2, '{}')`,
      [owner.deckId, JSON.stringify({ exact: [], substituted: [], notOwned: [], missing: [{ cardIdentifier: FLEX, name: 'Flex', quantity: 2, slot: 'mainboard', pitch: 1, cost: 0, type: 'Action', imageUrl: null }] })],
    );
    const deck = await runChatTool(toolbox, 'get_prices', { deckId: owner.deckId });

    expect(deck['cards']).toEqual([
      expect.objectContaining({ cardIdentifier: FLEX, quantity: 2, store: expect.objectContaining({ available: 2, lineCents: 600 }), tcgplayer: expect.objectContaining({ lineCents: 50 }) }),
    ]);
    expect(deck['store']).toEqual(expect.objectContaining({ totalCents: 600, cardsOutOfStock: 0, currency: 'BRL' }));
    expect(deck['tcgplayer']).toEqual(expect.objectContaining({ currency: 'USD', totalCents: 50 }));
    expect(await runChatTool(toolbox, 'get_prices', { deckId: other.deckId })).toEqual({ error: 'DECK_NOT_FOUND' });
    expect(await runChatTool(toolbox, 'get_prices', {})).toEqual(expect.objectContaining({ error: 'INVALID_ARGUMENTS' }));
  });

  it("get_deck returns the engine's full legality and each card's copy limit", async () => {
    const user = await fixture.chatUser();
    const deckId = await insertDeck(user, 'building', PACK_HUNT_DECK);
    const toolbox = toolboxFor(user);

    const deck = await runChatTool(toolbox, 'get_deck', { deckId });

    const expected = computeDeckLegality(
      {
        heroIdentifier: RHINAR,
        cards: PACK_HUNT_DECK.map((line) => ({ cardIdentifier: line.cardIdentifier, quantity: line.quantity, slot: line.slot, inventoryQuantity: line.inventoryQuantity ?? 0 })),
      },
      catalog,
      'Classic Constructed',
    );
    expect(deck['legality']).toEqual(JSON.parse(JSON.stringify(expected)));
    const legality = deck['legality'] as { category: string; details: Array<{ code: string; params: Record<string, unknown> }> };
    expect(legality.category).toBe('illegal');
    const copyProblems = legality.details.filter((detail) => detail.code === 'too_many_copies');
    expect(copyProblems).toHaveLength(1);
    expect(copyProblems[0]!.params).toMatchObject({ cardIdentifier: PACK_HUNT_RED, count: 4, limit: 3 });
    const cards = deck['cards'] as Array<{ cardIdentifier: string; copyLimit: number }>;
    expect(cards.find((card) => card.cardIdentifier === PACK_HUNT_RED)?.copyLimit).toBe(3);
    for (const card of cards) expect(card.copyLimit).toBe(getCopyLimit(catalog.getCard(card.cardIdentifier), 'Classic Constructed'));
  });

  it('get_prices with a deck and an empty list answers as for the deck alone', async () => {
    const user = await fixture.chatUser();
    const deckId = await insertDeck(user, 'building', PACK_HUNT_DECK);
    const toolbox = toolboxFor(user);

    const alone = await runChatTool(toolbox, 'get_prices', { deckId });
    const withEmptyList = await runChatTool(toolbox, 'get_prices', { deckId, cardIdentifiers: [] });

    expect(withEmptyList['error']).toBeUndefined();
    expect(withEmptyList).toEqual(alone);
    expect(await runChatTool(toolbox, 'get_prices', {})).toEqual(expect.objectContaining({ error: 'INVALID_ARGUMENTS' }));
    expect(await runChatTool(toolbox, 'get_prices', { cardIdentifiers: [] })).toEqual(expect.objectContaining({ error: 'INVALID_ARGUMENTS' }));
  });

  it('propose_swap proposes a one-copy swap', async () => {
    const user = await fixture.chatUser();
    const deckId = await insertDeck(user, 'building', PACK_HUNT_DECK);
    const toolbox = toolboxFor(user);
    const woundingBlow = catalog.cards.find((card) => card.name === 'Wounding Blow' && card.pitch === 1)!.cardIdentifier;

    const answer = await runChatTool(toolbox, 'propose_swap', {
      deckId,
      originalCardIdentifier: PACK_HUNT_RED,
      slot: 'mainboard',
      replacementCardIdentifier: woundingBlow,
      quantity: 1,
      side: 'inventory',
      reason: 'a legal card for the Rhinar deck',
    });

    expect(answer['ok']).toBe(true);
    expect(answer['quantity']).toBe(1);
    expect(answer['side']).toBe('inventory');
    expect((answer['comparison'] as { copies: number }).copies).toBe(1);
  });

  it('propose_swap refuses a bad quantity, side or copy count and stores no proposal', async () => {
    const user = await fixture.chatUser();
    const deckId = await insertDeck(user, 'building', PACK_HUNT_DECK);
    const woundingBlow = catalog.cards.find((card) => card.name === 'Wounding Blow' && card.pitch === 1)!.cardIdentifier;
    const swap = (overrides: Record<string, unknown>) => ({
      deckId,
      originalCardIdentifier: PACK_HUNT_RED,
      slot: 'mainboard',
      replacementCardIdentifier: woundingBlow,
      reason: 'a legal card for the Rhinar deck',
      ...overrides,
    });
    const refusals = [
      swap({ quantity: 0, side: 'deck' }),
      swap({ quantity: 2, side: 'inventory' }),
      swap({ quantity: 1, side: 'bench' }),
      swap({ quantity: 1, side: 'inventory', replacementCardIdentifier: PACK_HUNT_YELLOW }),
    ];

    for (const args of refusals) {
      const turn = tools.forTurn({ userId: user.userId, locale: 'en-US' });
      const answer = await runChatTool(turn.toolbox, 'propose_swap', args);

      expect(answer['ok']).toBe(false);
      expect(turn.proposals).toHaveLength(0);
    }
    for (const side of ['deck', 'inventory']) {
      const turn = tools.forTurn({ userId: user.userId, locale: 'en-US' });
      const answer = await runChatTool(turn.toolbox, 'propose_swap', swap({ quantity: 1, side }));

      expect(answer['ok']).toBe(true);
      expect(turn.proposals).toHaveLength(1);
    }
  });

  it("search_rules finds rules for the starter questions' searches", async () => {
    const toolbox = toolboxFor(await fixture.chatUser());
    const insertRule = `INSERT INTO rules_entry ("ruleNumber", "sectionNumber", "sectionTitle", text, url, "sourceHash", "fetchedAt") VALUES ($1, '9.9', 'Tools', $2, 'u', 'h', now())
       ON CONFLICT ("ruleNumber") DO UPDATE SET text = EXCLUDED.text`;
    await fixture.dataSource.query(insertRule, ['tools-starter-triggers', 'The combat chain keeps the order of triggers: triggered effects wait and the turn player picks their order.']);
    await fixture.dataSource.query(insertRule, ['tools-starter-copies', 'A constructed deck may hold at most the maximum copies of a card with the same name and pitch.']);
    await fixture.dataSource.query(insertRule, ['tools-starter-equipment', 'A Classic Constructed deck needs one weapon and equipment in each slot, with the requirements of its hero.']);

    const searches: Array<[string, string]> = [
      ['order of triggers when attacking', 'tools-starter-triggers'],
      ['constructed deck maximum copies same name pitch', 'tools-starter-copies'],
      ['Classic Constructed deck equipment weapon requirements', 'tools-starter-equipment'],
    ];
    for (const [query, ruleNumber] of searches) {
      const result = await runChatTool(toolbox, 'search_rules', { query });

      expect(result['found']).toBe(true);
      expect((result['entries'] as Array<{ ruleNumber: string }>).map((entry) => entry.ruleNumber)).toContain(ruleNumber);
    }
  });

  it('get_prices computes readiness for a deck with none stored', async () => {
    const user = await fixture.chatUser();
    const deckId = await insertDeck(user, 'building', PACK_HUNT_DECK);
    expect(await fixture.dataSource.query(`SELECT 1 FROM deck_readiness_snapshot WHERE "trackedDeckId" = $1`, [deckId])).toHaveLength(0);
    const toolbox = toolboxFor(user);

    const prices = await runChatTool(toolbox, 'get_prices', { deckId });

    expect(prices['error']).toBeUndefined();
    const cards = prices['cards'] as Array<{ cardIdentifier: string; quantity: number }>;
    expect(cards.map((card) => [card.cardIdentifier, card.quantity])).toEqual(
      expect.arrayContaining([
        [PACK_HUNT_RED, 4],
        [PACK_HUNT_YELLOW, 3],
        [PACK_HUNT_BLUE, 3],
      ]),
    );
  });

  it('search_cards finds Romping Club for Brute weapon', async () => {
    const user = await fixture.chatUser();
    const toolbox = toolboxFor(user);

    const found = await runChatTool(toolbox, 'search_cards', { query: 'Brute weapon' });

    expect((found['cards'] as Array<{ cardIdentifier: string }>).map((card) => card.cardIdentifier)).toContain('romping-club');
  });

  it('get_swap_candidates on a 4-copy Pack Hunt (Vermelho) returns candidates', async () => {
    const user = await fixture.chatUser();
    const deckId = await insertDeck(user, 'building', PACK_HUNT_DECK);
    const toolbox = toolboxFor(user);

    const found = await runChatTool(toolbox, 'get_swap_candidates', { deckId, cardIdentifier: PACK_HUNT_RED, slot: 'mainboard' });
    const one = await runChatTool(toolbox, 'get_swap_candidates', { deckId, cardIdentifier: PACK_HUNT_RED, slot: 'mainboard', quantity: 1 });

    expect(found['needed']).toBe(1);
    expect((found['groups'] as unknown[]).length).toBeGreaterThan(0);
    expect(one['needed']).toBe(1);
    expect((one['groups'] as unknown[]).length).toBeGreaterThan(0);
  });

  it("the Tutor's spare copies come from the spare function: Ideia and Aposentado decks hold none", async () => {
    const user = await fixture.chatUser();
    await fixture.own(user.sessionToken, [{ cardIdentifier: PACK_HUNT_RED, quantity: 3 }]);
    const building = await insertDeck(user, 'building', [
      { cardIdentifier: RHINAR, slot: 'hero', quantity: 1 },
      { cardIdentifier: PACK_HUNT_RED, slot: 'mainboard', quantity: 2 },
      { cardIdentifier: PACK_HUNT_YELLOW, slot: 'mainboard', quantity: 1 },
    ]);
    await insertDeck(user, 'idea', [{ cardIdentifier: PACK_HUNT_RED, slot: 'mainboard', quantity: 3 }], 'Ideia');
    await insertDeck(user, 'retired', [{ cardIdentifier: PACK_HUNT_RED, slot: 'mainboard', quantity: 3 }], 'Aposentado');
    const toolbox = toolboxFor(user);
    const { spare } = await fixture.app.get(SpareCopiesService).spareByCard(user.userId);

    const collection = await runChatTool(toolbox, 'get_collection', { query: 'pack hunt' });
    const candidates = await runChatTool(toolbox, 'get_swap_candidates', { deckId: building, cardIdentifier: PACK_HUNT_YELLOW, slot: 'mainboard' });

    const row = (collection['cards'] as Array<{ cardIdentifier: string; spare: number }>).find((entry) => entry.cardIdentifier === PACK_HUNT_RED);
    const candidate = (candidates['groups'] as Array<{ cards: Array<{ cardIdentifier: string; freeCopies: number }> }>)
      .flatMap((group) => group.cards)
      .find((entry) => entry.cardIdentifier === PACK_HUNT_RED);
    expect(spare.get(PACK_HUNT_RED)).toBe(1);
    expect(row?.spare).toBe(1);
    expect(candidate?.freeCopies).toBe(1);
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
      expect.objectContaining({ heroIdentifier: 'kano-dracai-of-aether', decks: 2, top8: 1, wins: 1, playerNamed: 0 }),
      expect.objectContaining({ heroIdentifier: 'dorinthea-ironsong', decks: 1, top8: 1, wins: 0, playerNamed: 1 }),
    ]);
    expect(meta['decks']).toBe(3);
  });

  it('get_collection lists owned copies, what each deck already uses and the spare copies', async () => {
    const user = await fixture.chatUser();
    await fixture.own(user.sessionToken, [
      { cardIdentifier: FLEX, quantity: 3 },
      { cardIdentifier: EMISSARY, quantity: 2 },
      { cardIdentifier: COAX, quantity: 1 },
      { cardIdentifier: 'consuming-volition-red', quantity: 1 },
    ]);
    const toolbox = toolboxFor(user);

    const forKatsu = await runChatTool(toolbox, 'get_collection', { heroIdentifier: KATSU, format: 'Classic Constructed' });
    const everything = await runChatTool(toolbox, 'get_collection', {});

    const rows = forKatsu['cards'] as Array<Record<string, unknown>>;
    expect(rows.find((row) => row['cardIdentifier'] === FLEX)).toEqual(
      expect.objectContaining({ owned: 3, spare: 1, cost: 0, usedByDecks: [{ deckId: user.deckId, quantity: 2 }] }),
    );
    expect(rows.find((row) => row['cardIdentifier'] === EMISSARY)).toEqual(expect.objectContaining({ owned: 2, spare: 0 }));
    expect(rows.find((row) => row['cardIdentifier'] === COAX)).toEqual(expect.objectContaining({ owned: 1, spare: 1, usedByDecks: [] }));
    expect(rows.map((row) => row['cardIdentifier'])).not.toContain('consuming-volition-red');
    expect((everything['cards'] as Array<{ cardIdentifier: string }>).map((row) => row.cardIdentifier)).toContain('consuming-volition-red');
  });

  it("get_tournament_deck compared with one of the user's decks marks each card's legality there, owned copies and copies in that deck", async () => {
    const user = await fixture.chatUser();
    await fixture.own(user.sessionToken, [{ cardIdentifier: FLEX, quantity: 3 }]);
    const toolbox = toolboxFor(user);
    const [{ id }] = (await fixture.dataSource.query(
      `INSERT INTO tournament_deck ("fabraryUlid", name, "eventName", placement, "heroIdentifier", format, "deckCreatedAt", "syncedAt", source)
       VALUES ('01TOOLS0000000000000000041', 'Calling: Recife 1st', 'Calling: Recife', 1, $1, 'Classic Constructed', now(), now(), 'tournament') RETURNING id`,
      [KATSU],
    )) as [{ id: string }];
    await fixture.dataSource.query(
      `INSERT INTO tournament_deck_card ("tournamentDeckId", "cardIdentifier", quantity, "sideboardQuantity") VALUES ($1, $2, 3, 0), ($1, 'consuming-volition-red', 1, 0)`,
      [id, FLEX],
    );

    const compared = await runChatTool(toolbox, 'get_tournament_deck', { id, compareDeckId: user.deckId });
    const other = await fixture.chatUser();

    const cards = compared['cards'] as Array<Record<string, unknown>>;
    expect(cards.find((card) => card['cardIdentifier'] === FLEX)).toEqual(expect.objectContaining({ legalInYourDeck: true, owned: 3, inYourDeck: 2 }));
    expect(cards.find((card) => card['cardIdentifier'] === 'consuming-volition-red')).toEqual(
      expect.objectContaining({ legalInYourDeck: false, owned: 0, inYourDeck: 0 }),
    );
    expect(await runChatTool(toolbox, 'get_tournament_deck', { id, compareDeckId: other.deckId })).toEqual({ error: 'DECK_NOT_FOUND' });
  });

  it('get_tournament_meta says whether each hero is legal in that format today and when it first appeared', async () => {
    const user = await fixture.chatUser();
    const toolbox = toolboxFor(user);
    const insert = `INSERT INTO tournament_deck ("fabraryUlid", name, "eventName", placement, "heroIdentifier", format, "deckCreatedAt", "syncedAt", source)
      VALUES ($1, 'x', null, 1, $2, 'Open', $3, now(), 'tournament')`;
    await fixture.dataSource.query(insert, ['01TOOLS0000000000000000051', 'victor-goldmane-high-and-mighty', '2025-03-01T00:00:00Z']);
    await fixture.dataSource.query(insert, ['01TOOLS0000000000000000052', 'victor-goldmane-high-and-mighty', '2026-03-01T00:00:00Z']);
    await fixture.dataSource.query(insert.replace("'Open'", "'Classic Constructed'"), ['01TOOLS0000000000000000053', 'victor-goldmane-high-and-mighty', '2025-04-01T00:00:00Z']);

    const open = await runChatTool(toolbox, 'get_tournament_meta', { format: 'Open' });
    const cc = await runChatTool(toolbox, 'get_tournament_meta', { format: 'Classic Constructed' });

    expect((open['heroes'] as Array<Record<string, unknown>>)[0]).toEqual(
      expect.objectContaining({ heroIdentifier: 'victor-goldmane-high-and-mighty', heroLegal: true, firstSeen: expect.anything() }),
    );
    expect(new Date((open['heroes'] as Array<{ firstSeen: string }>)[0]!.firstSeen).toISOString()).toBe('2025-03-01T00:00:00.000Z');
    expect((cc['heroes'] as Array<Record<string, unknown>>).find((hero) => hero['heroIdentifier'] === 'victor-goldmane-high-and-mighty')).toEqual(
      expect.objectContaining({ heroLegal: false }),
    );
  });

  it('search_rules answers several topics in one call, a few rules each', async () => {
    const toolbox = toolboxFor(await fixture.chatUser());
    const insertRule = `INSERT INTO rules_entry ("ruleNumber", "sectionNumber", "sectionTitle", text, url, "sourceHash", "fetchedAt") VALUES ($1, '9.9', 'Tools', $2, 'u', 'h', now())`;
    for (let index = 1; index <= 6; index += 1) await fixture.dataSource.query(insertRule, [`tools-${index}`, `zanzibar quokka rule ${index}`]);
    await fixture.dataSource.query(insertRule, ['tools-7', 'xylophone wombat rule']);

    const result = await runChatTool(toolbox, 'search_rules', { queries: ['zanzibar quokka', 'xylophone wombat'] });

    const results = result['results'] as Array<{ query: string; found: boolean; entries: Array<{ ruleNumber: string }> }>;
    expect(results.map((entry) => [entry.query, entry.found])).toEqual([
      ['zanzibar quokka', true],
      ['xylophone wombat', true],
    ]);
    expect(results[0]!.entries).toHaveLength(BATCH_RULE_LIMIT);
    expect(results[1]!.entries.map((entry) => entry.ruleNumber)).toEqual(['tools-7']);
  });

  it('get_community_decks sums the complete legal regular decks of that exact hero and format and says they are not tournament results', async () => {
    const user = await fixture.chatUser();
    const other = await fixture.chatUser();
    const toolbox = toolboxFor(user);
    const hero = catalog.getCard('azalea');
    const mainboard = catalog.cards
      .filter((card) => slotOf(card) === 'mainboard' && findCardLegalityViolation(card, hero, 'Silver Age') === null)
      .slice(0, 20)
      .map((card) => ({ cardIdentifier: card.cardIdentifier, quantity: 2, slot: 'mainboard' as const }));
    const recent = new Date(Date.now() - 86_400_000).toISOString();
    const requests: IIndexRequest[] = [];
    (fixture.app.get(FabraryIndexClient) as unknown as { query: (request: IIndexRequest) => Promise<IIndexResult> }).query = async (request) => {
      requests.push(request);
      return {
        nbHits: 2,
        hits: [
          { deckId: '01COMMUNITY00000000000001', name: 'Azalea SAGE', format: 'Silver Age', heroIdentifier: 'azalea', updatedAt: recent, hasResults: true },
          { deckId: '01COMMUNITY00000000000002', name: 'Half built', format: 'Silver Age', heroIdentifier: 'azalea', updatedAt: recent },
        ],
      };
    };
    const fabrary = fixture.app.get(FabraryService) as jest.Mocked<FabraryService>;
    fabrary.fetchCommunityDeck.mockImplementation(async (ulid: string) => ({
      ulid,
      name: ulid,
      format: 'Silver Age',
      hero: { cardIdentifier: 'azalea', name: 'Azalea' },
      mainboard: ulid.endsWith('1') ? mainboard : mainboard.slice(0, 5),
      equipment: [],
      weapons: [],
      inventory: [],
      matchupPlans: 3,
    }));

    const result = await runChatTool(toolbox, 'get_community_decks', { heroIdentifier: 'azalea', format: 'Silver Age' });
    const badFormat = await runChatTool(toolbox, 'get_community_decks', { heroIdentifier: 'azalea', format: 'Commoner' });

    expect(requests[0]!.filters).toContain('heroIdentifier:"azalea"');
    expect(result['note']).toEqual(expect.stringContaining('not tournament results'));
    expect(result['decksUsed']).toBe(1);
    expect(result['decksChecked']).toBe(2);
    expect(result['decks']).toEqual([
      {
        name: 'Azalea SAGE',
        updatedAt: recent.slice(0, 10),
        hasResults: true,
        matchupPlans: 3,
        inventoryCards: 0,
        url: 'https://fabrary.net/decks/01COMMUNITY00000000000001',
        mainboardByType: expect.any(Object),
        mainboardByPitch: expect.any(Object),
        mainboardByCost: expect.any(Object),
      },
    ]);
    const [only] = result['decks'] as Array<{ mainboardByType: Record<string, number> }>;
    const byType = (result['mainboardRange'] as { byType: Record<string, { average: number; min: number; max: number }> }).byType;
    expect(Object.fromEntries(Object.entries(byType).map(([kind, range]) => [kind, [range.average, range.min, range.max]]))).toEqual(
      Object.fromEntries(Object.entries(only!.mainboardByType).map(([kind, count]) => [kind, [count, count, count]])),
    );
    expect(result['comparison']).toBeUndefined();

    const compared = await runChatTool(toolbox, 'get_community_decks', { heroIdentifier: 'azalea', format: 'Silver Age', compareDeckId: user.deckId });
    const yourRows = (await fixture.dataSource.query(`SELECT "cardIdentifier", slot FROM deck_card WHERE "trackedDeckId" = $1`, [user.deckId])) as Array<{
      cardIdentifier: string;
      slot: string;
    }>;
    const yourCards = new Set(yourRows.filter((row) => row.slot !== 'hero').map((row) => row.cardIdentifier));
    const reference = new Set(mainboard.map((row) => row.cardIdentifier));
    const comparison = compared['comparison'] as { yourCards: Array<{ cardIdentifier: string; referenceDecks: number }>; commonCardsYouLack: Array<{ cardIdentifier: string }> };
    expect(new Set(comparison.yourCards.map((card) => card.cardIdentifier))).toEqual(yourCards);
    expect(comparison.yourCards.every((card) => card.referenceDecks === (reference.has(card.cardIdentifier) ? 1 : 0))).toBe(true);
    expect(new Set(comparison.commonCardsYouLack.map((card) => card.cardIdentifier))).toEqual(new Set([...reference].filter((id) => !yourCards.has(id))));
    expect(await runChatTool(toolbox, 'get_community_decks', { heroIdentifier: 'azalea', format: 'Silver Age', compareDeckId: other.deckId })).toEqual({
      error: 'DECK_NOT_FOUND',
    });
    expect((result['cards'] as Array<{ decks: number; averageCopies: number }>)[0]).toEqual(expect.objectContaining({ decks: 1, averageCopies: 2 }));
    expect(badFormat).toEqual(expect.objectContaining({ error: 'INVALID_ARGUMENTS' }));
  });

  it('get_community_decks answers that the decks are unavailable when Fabrary cannot be reached', async () => {
    const toolbox = toolboxFor(await fixture.chatUser());
    (fixture.app.get(FabraryIndexClient) as unknown as { query: () => Promise<IIndexResult> }).query = async () => {
      throw new Error('index down');
    };

    const result = await runChatTool(toolbox, 'get_community_decks', { heroIdentifier: 'kano', format: 'Blitz' });

    expect(result).toEqual(expect.objectContaining({ error: 'COMMUNITY_DECKS_UNAVAILABLE' }));
  });
});
