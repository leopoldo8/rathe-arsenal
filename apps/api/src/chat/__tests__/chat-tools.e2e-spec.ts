import { catalog, findCardLegalityViolation } from '@rathe-arsenal/engine';
import { BATCH_CARD_LIMIT, BATCH_RULE_LIMIT, runChatTool } from '../chat-tools';
import { ChatToolsService } from '../chat-tools.service';
import { FabraryService } from '../../fabrary/fabrary.service';
import { FabraryIndexClient, IIndexRequest, IIndexResult } from '../../reference/fabrary-index';
import { slotOf } from '../proposal-validation';
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
    await fixture.own(owner.jwt, [{ cardIdentifier: EMISSARY_OF_WIND, quantity: 1 }]);
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
    await fixture.own(user.jwt, [
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
    await fixture.own(user.jwt, [{ cardIdentifier: FLEX, quantity: 3 }]);
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
    const toolbox = toolboxFor(await fixture.chatUser());
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
      },
    ]);
    expect(result['averageMainboardByType']).toEqual((result['decks'] as Array<{ mainboardByType: unknown }>)[0]!.mainboardByType);
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
