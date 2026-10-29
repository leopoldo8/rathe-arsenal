import { Logger } from '@nestjs/common';
import { catalog, computeDeckLegality } from '@rathe-arsenal/engine';
import { SubstitutionService } from '../../substitution/substitution.service';
import { bootChatFixture, callAnswer, COAX, EMISSARY, FLEX, IChatFixture, IChatUser, KATSU, scriptedFetch, TALISHAR, textAnswer } from './chat-e2e.fixture';

const ADRENALINE = 'adrenaline-rush-red';
const CC = 'Classic Constructed';
const RHINAR = 'rhinar-reckless-rampage';
const PACK_HUNT_RED = 'pack-hunt-red';
const PACK_HUNT_YELLOW = 'pack-hunt-yellow';
const PACK_HUNT_BLUE = 'pack-hunt-blue';
const UNKNOWN_UUID = '0f1e2d3c-4b5a-4968-8776-655443322110';

interface IProposalSeed {
  readonly kind: 'deck' | 'swap';
  readonly payload: Record<string, unknown>;
  readonly status?: string;
  readonly trackedDeckId?: number | null;
}

describe('chat proposals (E2E)', () => {
  let fixture: IChatFixture;

  beforeAll(async () => {
    fixture = await bootChatFixture();
  }, 60_000);

  afterAll(async () => {
    await fixture.close();
  });

  async function answeredMessage(user: IChatUser): Promise<{ conversationId: string; messageId: string }> {
    const conversationId = await fixture.conversation(user);
    const { assistantMessageId } = await fixture.send(user, conversationId, 'ideas?');
    await fixture.dataSource.query(`UPDATE chat_message SET status = 'done', text = 'Here.' WHERE id = $1`, [assistantMessageId]);
    return { conversationId, messageId: assistantMessageId };
  }

  async function seed(messageId: string, proposal: IProposalSeed): Promise<string> {
    const [{ id }] = (await fixture.dataSource.query(
      `INSERT INTO chat_proposal ("messageId", kind, status, payload, reason, "trackedDeckId") VALUES ($1, $2, $3, $4, 'because', $5) RETURNING id`,
      [messageId, proposal.kind, proposal.status ?? 'pending', JSON.stringify(proposal.payload), proposal.trackedDeckId ?? null],
    )) as [{ id: string }];
    return id;
  }

  function deckPayload(cards: Array<[string, number]>, name = 'Chat Katsu'): Record<string, unknown> {
    return { name, heroIdentifier: KATSU, format: CC, cards: cards.map(([cardIdentifier, quantity]) => ({ cardIdentifier, quantity, slot: 'mainboard' })) };
  }

  function swapPayload(user: IChatUser, replacement = COAX): Record<string, unknown> {
    return { trackedDeckId: user.deckId, originalCardIdentifier: FLEX, slot: 'mainboard', replacementCardIdentifier: replacement };
  }

  async function count(sql: string, params: unknown[]): Promise<number> {
    const [{ count: value }] = (await fixture.dataSource.query(sql, params)) as [{ count: number }];
    return value;
  }

  const decksOf = (user: IChatUser) => count(`SELECT count(*)::int AS count FROM tracked_deck WHERE "userId" = $1`, [user.userId]);
  const replacementsOf = (user: IChatUser) => count(`SELECT count(*)::int AS count FROM card_replacement WHERE "userId" = $1`, [user.userId]);
  const proposalRow = async (id: string) =>
    ((await fixture.dataSource.query(`SELECT * FROM chat_proposal WHERE id = $1`, [id])) as Array<Record<string, unknown>>)[0];

  const factsOf = (cardIdentifier: string) => {
    const card = catalog.getCard(cardIdentifier);
    return JSON.parse(JSON.stringify({ types: card.types, subtypes: card.subtypes, cost: card.cost ?? null, power: card.power ?? null, defense: card.defense ?? null, pitch: card.pitch ?? null }));
  };
  const WOUNDING_BLOW_RED = catalog.cards.find((card) => card.name === 'Wounding Blow' && card.pitch === 1)!.cardIdentifier;

  /** The deck of the audit's F34: Rhinar in Classic Constructed with Pack Hunt (Vermelho) at 3 in the deck and 1 in the inventory. */
  async function insertRhinarDeck(user: IChatUser): Promise<number> {
    const [{ id }] = (await fixture.dataSource.query(
      `INSERT INTO tracked_deck ("userId", name, hero, "heroIdentifier", format, status)
       VALUES ($1, 'Rhinar CC', 'Rhinar, Reckless Rampage', $2, 'Classic Constructed', 'building') RETURNING id`,
      [user.userId, RHINAR],
    )) as [{ id: number }];
    const lines: Array<[string, string, number, number]> = [
      [RHINAR, 'hero', 1, 0],
      [PACK_HUNT_RED, 'mainboard', 3, 1],
      [PACK_HUNT_YELLOW, 'mainboard', 3, 0],
      [PACK_HUNT_BLUE, 'mainboard', 3, 0],
    ];
    for (const [cardIdentifier, slot, quantity, inventoryQuantity] of lines) {
      await fixture.dataSource.query(
        `INSERT INTO deck_card ("trackedDeckId", "cardIdentifier", quantity, "inventoryQuantity", slot) VALUES ($1, $2, $3, $4, $5)`,
        [id, cardIdentifier, quantity, inventoryQuantity, slot],
      );
    }
    return id;
  }

  /** A real turn: the scripted model calls propose_swap, and the proposal reaches the table through the turn's own finish. */
  async function swapThroughATurn(user: IChatUser, deckId: number, args: Record<string, unknown>) {
    const conversationId = await fixture.conversation(user, { trackedDeckId: deckId });
    const { assistantMessageId } = await fixture.send(user, conversationId, 'Meu Rhinar CC está com Pack Hunt (Vermelho) a mais.');
    const swap = { deckId, originalCardIdentifier: PACK_HUNT_RED, slot: 'mainboard', replacementCardIdentifier: WOUNDING_BLOW_RED, reason: 'legal and cheap', ...args };
    const stub = scriptedFetch([callAnswer([{ id: 's1', name: 'propose_swap', args: swap }]), textAnswer('Posso trocar uma cópia.')]);
    await fixture.drain(stub.fetch);
    const [proposal] = (await fixture.dataSource.query(`SELECT * FROM chat_proposal WHERE "messageId" = $1`, [assistantMessageId])) as Array<Record<string, any>>;
    if (!proposal) throw new Error('the turn stored no proposal');
    return { conversationId, messageId: assistantMessageId, proposal };
  }

  async function rhinarOwner(): Promise<{ user: IChatUser; deckId: number }> {
    const user = await fixture.chatUser();
    const deckId = await insertRhinarDeck(user);
    await fixture.own(user.sessionToken, [{ cardIdentifier: PACK_HUNT_RED, quantity: 4 }]);
    return { user, deckId };
  }

  it('a swap proposal stores quantity, side and the missing count before and after', async () => {
    const { user, deckId } = await rhinarOwner();
    const missingNow = (await fixture.app.get(SubstitutionService).computeReadiness(deckId, user.userId)).missingCopies.total;

    const { proposal } = await swapThroughATurn(user, deckId, { quantity: 1, side: 'inventory' });

    expect(proposal.kind).toBe('swap');
    expect(proposal.payload).toMatchObject({ quantity: 1, side: 'inventory', missingBefore: missingNow, missingAfter: missingNow + 1 });
  });

  it('the conversation returns the stored swap effect, not a recomputed one', async () => {
    const { user, deckId } = await rhinarOwner();
    const { conversationId, proposal } = await swapThroughATurn(user, deckId, { quantity: 1, side: 'inventory' });
    const read = async () =>
      (await fixture.get(`/api/chat/conversations/${conversationId}`, user.sessionToken).expect(200)).body.messages[1].proposals[0] as { payload: Record<string, unknown> };

    expect([typeof proposal.payload.missingBefore, typeof proposal.payload.missingAfter]).toEqual(['number', 'number']);
    const before = await read();
    await fixture.own(user.sessionToken, [{ cardIdentifier: WOUNDING_BLOW_RED, quantity: 1 }]);
    const after = await read();

    for (const view of [before, after]) {
      expect(view.payload).toMatchObject({
        quantity: 1,
        side: 'inventory',
        missingBefore: proposal.payload.missingBefore,
        missingAfter: proposal.payload.missingAfter,
      });
    }
  });

  it("a swap proposal carries the incoming card's free copies and Cúpula DT price, and the copies that stay", async () => {
    await fixture.dataSource.query(
      `INSERT INTO store (slug, name, "baseUrl", "listingPath", "rateLimitMs", active)
       VALUES ('cupula-dt', 'Cúpula DT', 'https://www.cupuladt.com.br', '/?view=ecom/itens&tcg=8', 1500, true)
       ON CONFLICT (slug) DO NOTHING`,
    );
    await fixture.dataSource.query(
      `INSERT INTO store_stock ("storeId", "cardIdentifier", "priceCents", quantity, "productUrl", "productNameRaw", "lastFetchedAt")
       VALUES ((SELECT id FROM store WHERE slug = 'cupula-dt'), $1, 250, 5, 'https://www.cupuladt.com.br/produto/wounding-blow', 'Wounding Blow (Red)', now())
       ON CONFLICT ("storeId", "cardIdentifier") DO UPDATE SET "priceCents" = 250, quantity = 5, "lastFetchedAt" = now()`,
      [WOUNDING_BLOW_RED],
    );
    const { user, deckId } = await rhinarOwner();
    const { conversationId } = await swapThroughATurn(user, deckId, { quantity: 1, side: 'inventory' });
    const deckSide = await swapThroughATurn(user, deckId, { quantity: 1, side: 'deck' });
    const read = async (id: string) =>
      (await fixture.get(`/api/chat/conversations/${id}`, user.sessionToken).expect(200)).body.messages[1].proposals[0].display as {
        original: Record<string, unknown>;
        replacement: Record<string, unknown>;
      };

    const none = await read(conversationId);
    await fixture.own(user.sessionToken, [{ cardIdentifier: WOUNDING_BLOW_RED, quantity: 2 }]);
    const two = await read(conversationId);
    const deckDisplay = await read(deckSide.conversationId);

    expect([none.replacement['freeCopies'], two.replacement['freeCopies']]).toEqual([0, 2]);
    expect(two.replacement['storePriceCents']).toBe(250);
    expect(two.replacement['facts']).toEqual(factsOf(WOUNDING_BLOW_RED));
    expect(two.original['facts']).toEqual(factsOf(PACK_HUNT_RED));
    expect([two.original['copiesInDeck'], two.original['copiesLeft']]).toEqual([3, 3]);
    expect([deckDisplay.original['copiesInDeck'], deckDisplay.original['copiesLeft']]).toEqual([3, 2]);
    await fixture.dataSource.query(`DELETE FROM store_stock WHERE "cardIdentifier" = $1`, [WOUNDING_BLOW_RED]);
    expect((await read(conversationId)).replacement['storePriceCents']).toBeNull();
  });

  it('applying a one-copy swap moves exactly one copy from the stated side', async () => {
    const { user, deckId } = await rhinarOwner();
    const inventorySwap = await swapThroughATurn(user, deckId, { quantity: 1, side: 'inventory' });

    const applied = await fixture.post(`/api/chat/proposals/${inventorySwap.proposal.id}/apply`, user.sessionToken).expect(201);

    const rows = (await fixture.dataSource.query(
      `SELECT "cardIdentifier", quantity, "inventoryQuantity" FROM deck_card WHERE "trackedDeckId" = $1 AND slot = 'mainboard'`,
      [deckId],
    )) as Array<{ cardIdentifier: string; quantity: number; inventoryQuantity: number }>;
    const byCard = Object.fromEntries(rows.map((row) => [row.cardIdentifier, [row.quantity, row.inventoryQuantity]]));
    expect(byCard[PACK_HUNT_RED]).toEqual([3, 0]);
    expect(byCard[WOUNDING_BLOW_RED]).toEqual([0, 1]);
    const replacements = await fixture.replacementRows(deckId);
    expect(replacements.map((row) => [row['id'], row['quantity'], row['side'], row['pickedFrom']])).toEqual([[applied.body.replacementId, 1, 'inventory', 'chat']]);
    const legality = computeDeckLegality(
      { heroIdentifier: RHINAR, cards: rows.map((row) => ({ ...row, slot: 'mainboard' })) },
      catalog,
      'Classic Constructed',
    );
    expect(legality.details.filter((detail) => detail.code === 'too_many_copies' && (detail.params as { cardIdentifier?: string }).cardIdentifier === PACK_HUNT_RED)).toEqual([]);
    const missingNow = (await fixture.app.get(SubstitutionService).computeReadiness(deckId, user.userId)).missingCopies.total;
    expect(missingNow).toBe(inventorySwap.proposal.payload.missingAfter);

    const other = await rhinarOwner();
    const deckSwap = await swapThroughATurn(other.user, other.deckId, { quantity: 1, side: 'deck' });
    await fixture.post(`/api/chat/proposals/${deckSwap.proposal.id}/apply`, other.user.sessionToken).expect(201);
    const deckRows = (await fixture.dataSource.query(
      `SELECT "cardIdentifier", quantity, "inventoryQuantity" FROM deck_card WHERE "trackedDeckId" = $1 AND slot = 'mainboard'`,
      [other.deckId],
    )) as Array<{ cardIdentifier: string; quantity: number; inventoryQuantity: number }>;
    const deckByCard = Object.fromEntries(deckRows.map((row) => [row.cardIdentifier, [row.quantity, row.inventoryQuantity]]));
    expect(deckByCard[PACK_HUNT_RED]).toEqual([2, 1]);
    expect(deckByCard[WOUNDING_BLOW_RED]).toEqual([1, 0]);
  });

  it('proposals carry live owned and missing counts', async () => {
    const user = await fixture.chatUser();
    await fixture.own(user.sessionToken, [
      { cardIdentifier: EMISSARY, quantity: 4 },
      { cardIdentifier: FLEX, quantity: 3 },
      { cardIdentifier: COAX, quantity: 1 },
    ]);
    const { conversationId, messageId } = await answeredMessage(user);
    await seed(messageId, { kind: 'deck', payload: deckPayload([[EMISSARY, 2], [ADRENALINE, 3], [TALISHAR, 1]]) });
    await fixture.own(user.sessionToken, [{ cardIdentifier: ADRENALINE, quantity: 1 }]);
    await seed(messageId, { kind: 'swap', payload: swapPayload(user, COAX), trackedDeckId: user.deckId });
    await seed(messageId, { kind: 'swap', payload: swapPayload(user, 'brutal-assault-red'), trackedDeckId: user.deckId });

    const read = (await fixture.get(`/api/chat/conversations/${conversationId}`, user.sessionToken).expect(200)).body;
    const proposals = read.messages[1].proposals as Array<{ kind: string; ownedCount: number; missingCount: number }>;

    expect(proposals.map((proposal) => [proposal.kind, proposal.ownedCount, proposal.missingCount])).toEqual([
      ['deck', 3, 3],
      ['swap', 1, 0],
      ['swap', 0, 1],
    ]);
  });

  it('proposals carry display fields and their deck', async () => {
    const user = await fixture.chatUser();
    await fixture.own(user.sessionToken, [{ cardIdentifier: EMISSARY, quantity: 4 }]);
    const { conversationId, messageId } = await answeredMessage(user);
    const deckProposal = await seed(messageId, { kind: 'deck', payload: deckPayload([[EMISSARY, 3], [FLEX, 1]]) });
    await seed(messageId, { kind: 'swap', payload: swapPayload(user, EMISSARY), trackedDeckId: user.deckId });
    const read = async () =>
      (await fixture.get(`/api/chat/conversations/${conversationId}`, user.sessionToken).expect(200)).body.messages[1].proposals as Array<Record<string, unknown>>;

    const [deck, swap] = await read();

    expect([deck!['trackedDeckId'], deck!['display']]).toEqual([
      null,
      {
        heroName: 'Katsu, the Wanderer',
        cards: [
          { cardIdentifier: EMISSARY, name: 'Emissary of Tides', pitch: 1, quantity: 3, slot: 'mainboard', ownedQuantity: 3 },
          { cardIdentifier: FLEX, name: 'Flex', pitch: 1, quantity: 1, slot: 'mainboard', ownedQuantity: 0 },
        ],
      },
    ]);
    expect([swap!['trackedDeckId'], swap!['display']]).toEqual([
      user.deckId,
      {
        original: { cardIdentifier: FLEX, name: 'Flex', pitch: 1, imageUrl: catalog.getCard(FLEX).imageUrl, copiesInDeck: 2, copiesLeft: 2, facts: factsOf(FLEX) },
        replacement: {
          cardIdentifier: EMISSARY,
          name: 'Emissary of Tides',
          pitch: 1,
          imageUrl: catalog.getCard(EMISSARY).imageUrl,
          freeCopies: 2,
          storePriceCents: null,
          facts: factsOf(EMISSARY),
        },
      },
    ]);

    const applied = await fixture.post(`/api/chat/proposals/${deckProposal}/apply`, user.sessionToken).expect(201);
    expect((await read())[0]!['trackedDeckId']).toBe(applied.body.trackedDeckId);
  });

  it('an applied swap carries its replacement and its status', async () => {
    const user = await fixture.chatUser();
    await fixture.own(user.sessionToken, [{ cardIdentifier: COAX, quantity: 3 }]);
    const { conversationId, messageId } = await answeredMessage(user);
    const id = await seed(messageId, { kind: 'swap', payload: swapPayload(user, COAX), trackedDeckId: user.deckId });
    const read = async () => {
      const [proposal] = (await fixture.get(`/api/chat/conversations/${conversationId}`, user.sessionToken).expect(200)).body.messages[1].proposals as Array<Record<string, unknown>>;
      return [proposal!['cardReplacementId'], proposal!['replacementStatus']];
    };

    const before = await read();
    const applied = await fixture.post(`/api/chat/proposals/${id}/apply`, user.sessionToken).expect(201);
    const active = await read();
    await fixture.post(`/api/replacements/${applied.body.replacementId}/revert`, user.sessionToken).expect(200);
    const reverted = await read();

    expect([before, active, reverted]).toEqual([
      [null, null],
      [applied.body.replacementId, 'active'],
      [applied.body.replacementId, 'reverted'],
    ]);
  });

  it('applying a deck proposal creates the deck with its cards', async () => {
    const user = await fixture.chatUser();
    const { messageId } = await answeredMessage(user);
    const id = await seed(messageId, { kind: 'deck', payload: deckPayload([[EMISSARY, 2], [FLEX, 3]], 'Chat Katsu tempo') });

    const applied = await fixture.post(`/api/chat/proposals/${id}/apply`, user.sessionToken).expect(201);

    const deckId = applied.body.trackedDeckId as number;
    const [deck] = (await fixture.dataSource.query(`SELECT name, "heroIdentifier", format, status, "fabraryUlid", "userId" FROM tracked_deck WHERE id = $1`, [deckId])) as Array<Record<string, unknown>>;
    expect(deck).toEqual({ name: 'Chat Katsu tempo', heroIdentifier: KATSU, format: CC, status: 'idea', fabraryUlid: null, userId: user.userId });
    expect(await fixture.deckCards(deckId)).toEqual({ [`${EMISSARY}@mainboard`]: 2, [`${FLEX}@mainboard`]: 3 });
    const row = await proposalRow(id);
    expect([row!['status'], row!['trackedDeckId'], row!['decidedAt'] instanceof Date]).toEqual(['applied', deckId, true]);
    expect(await count(`SELECT count(*)::int AS count FROM recommendation_run WHERE "trackedDeckId" = $1 AND status = 'pending' AND trigger = 'auto'`, [deckId])).toBe(1);
    expect(await fixture.snapshotCount(deckId)).toBe(1);
  });

  it('applying a swap records a chat replacement', async () => {
    const user = await fixture.chatUser();
    const { messageId } = await answeredMessage(user);
    const id = await seed(messageId, { kind: 'swap', payload: swapPayload(user), trackedDeckId: user.deckId });
    const snapshotsBefore = await fixture.snapshotCount(user.deckId);
    await fixture.dataSource.query(`DELETE FROM recommendation_run WHERE "trackedDeckId" = $1`, [user.deckId]);

    const applied = await fixture.post(`/api/chat/proposals/${id}/apply`, user.sessionToken).expect(201);

    const cards = await fixture.deckCards(user.deckId);
    expect(cards[`${FLEX}@mainboard`]).toBeUndefined();
    expect(cards[`${COAX}@mainboard`]).toBe(2);
    const replacements = await fixture.replacementRows(user.deckId);
    expect(replacements.map((row) => [row['id'], row['status'], row['pickedFrom'], row['quantity']])).toEqual([[applied.body.replacementId, 'active', 'chat', 2]]);
    const row = await proposalRow(id);
    expect([row!['status'], row!['cardReplacementId']]).toEqual(['applied', applied.body.replacementId]);
    expect(await fixture.snapshotCount(user.deckId)).toBeGreaterThan(snapshotsBefore);
    expect(await count(`SELECT count(*)::int AS count FROM recommendation_run WHERE "trackedDeckId" = $1 AND status = 'pending' AND trigger = 'auto'`, [user.deckId])).toBe(1);
  });

  it('only a pending proposal applies', async () => {
    const user = await fixture.chatUser();
    const { messageId } = await answeredMessage(user);
    const ids = await Promise.all(
      ['applied', 'dismissed', 'stale'].map((status) => seed(messageId, { kind: 'deck', payload: deckPayload([[FLEX, 2]]), status })),
    );
    const [decks, replacements] = [await decksOf(user), await replacementsOf(user)];

    const responses = await Promise.all(ids.map((id) => fixture.post(`/api/chat/proposals/${id}/apply`, user.sessionToken)));

    expect(responses.map((response) => [response.status, response.body.code])).toEqual(ids.map(() => [409, 'PROPOSAL_NOT_PENDING']));
    expect([await decksOf(user), await replacementsOf(user)]).toEqual([decks, replacements]);
  });

  it('a proposal that no longer applies turns stale', async () => {
    const cutGone = await fixture.chatUser();
    const cutMessage = await answeredMessage(cutGone);
    const cutId = await seed(cutMessage.messageId, { kind: 'swap', payload: swapPayload(cutGone), trackedDeckId: cutGone.deckId });
    await fixture
      .put(`/api/decks/${cutGone.deckId}`, cutGone.sessionToken)
      .send({ heroIdentifier: KATSU, format: CC, cards: [{ cardIdentifier: EMISSARY, quantity: 2, slot: 'mainboard' }, { cardIdentifier: TALISHAR, quantity: 1, slot: 'weapon' }] })
      .expect(200);

    const deckGone = await fixture.chatUser();
    const goneMessage = await answeredMessage(deckGone);
    const goneId = await seed(goneMessage.messageId, { kind: 'swap', payload: swapPayload(deckGone), trackedDeckId: deckGone.deckId });
    await fixture.del(`/api/decks/${deckGone.deckId}`, deckGone.sessionToken).expect((response) => expect(response.status).toBeLessThan(300));

    const invalid = await fixture.chatUser();
    const invalidMessage = await answeredMessage(invalid);
    const invalidId = await seed(invalidMessage.messageId, { kind: 'deck', payload: deckPayload([['card-retired-from-catalog', 2]]) });
    const copyGone = await rhinarOwner();
    const copyGoneSwap = await swapThroughATurn(copyGone.user, copyGone.deckId, { quantity: 1, side: 'inventory' });
    await fixture.dataSource.query(`UPDATE deck_card SET "inventoryQuantity" = 0 WHERE "trackedDeckId" = $1 AND "cardIdentifier" = $2`, [copyGone.deckId, PACK_HUNT_RED]);
    const copyGoneBefore = [await decksOf(copyGone.user), await replacementsOf(copyGone.user)];

    const before = await Promise.all([cutGone, deckGone, invalid].map(async (user) => [await decksOf(user), await replacementsOf(user)]));

    const responses = await Promise.all([
      fixture.post(`/api/chat/proposals/${cutId}/apply`, cutGone.sessionToken),
      fixture.post(`/api/chat/proposals/${goneId}/apply`, deckGone.sessionToken),
      fixture.post(`/api/chat/proposals/${invalidId}/apply`, invalid.sessionToken),
    ]);

    expect(responses.map((response) => [response.status, response.body.code])).toEqual([
      [409, 'PROPOSAL_STALE'],
      [409, 'PROPOSAL_STALE'],
      [409, 'PROPOSAL_STALE'],
    ]);
    expect((await Promise.all([cutId, goneId, invalidId].map(proposalRow))).map((row) => row!['status'])).toEqual(['stale', 'stale', 'stale']);

    const copyResponse = await fixture.post(`/api/chat/proposals/${copyGoneSwap.proposal.id}/apply`, copyGone.user.sessionToken);
    expect([copyResponse.status, copyResponse.body.code]).toEqual([409, 'PROPOSAL_STALE']);
    expect(await fixture.deckCards(copyGone.deckId)).not.toHaveProperty(`${WOUNDING_BLOW_RED}@mainboard`);
    expect([await decksOf(copyGone.user), await replacementsOf(copyGone.user)]).toEqual(copyGoneBefore);
    const staleRead = (await fixture.get(`/api/chat/conversations/${copyGoneSwap.conversationId}`, copyGone.user.sessionToken).expect(200)).body;
    expect(staleRead.messages[1].proposals[0].status).toBe('stale');
    expect(await Promise.all([cutGone, deckGone, invalid].map(async (user) => [await decksOf(user), await replacementsOf(user)]))).toEqual(before);
  });

  it('concurrent applies create one effect', async () => {
    const user = await fixture.chatUser();
    const { messageId } = await answeredMessage(user);
    const deckId = await seed(messageId, { kind: 'deck', payload: deckPayload([[FLEX, 2]], 'Race deck') });
    const swapId = await seed(messageId, { kind: 'swap', payload: swapPayload(user), trackedDeckId: user.deckId });
    const decksBefore = await decksOf(user);

    const deckRace = await Promise.all([1, 2].map(() => fixture.post(`/api/chat/proposals/${deckId}/apply`, user.sessionToken)));
    const swapRace = await Promise.all([1, 2].map(() => fixture.post(`/api/chat/proposals/${swapId}/apply`, user.sessionToken)));

    expect(deckRace.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(swapRace.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await decksOf(user)).toBe(decksBefore + 1);
    expect(await replacementsOf(user)).toBe(1);
  });

  it('dismiss closes a pending proposal', async () => {
    const user = await fixture.chatUser();
    const { messageId } = await answeredMessage(user);
    const id = await seed(messageId, { kind: 'deck', payload: deckPayload([[FLEX, 2]]) });

    const dismissed = await fixture.post(`/api/chat/proposals/${id}/dismiss`, user.sessionToken).expect(200);
    const again = await fixture.post(`/api/chat/proposals/${id}/dismiss`, user.sessionToken).expect(409);

    expect(dismissed.body).toEqual({ id, status: 'dismissed' });
    expect((await proposalRow(id))!['decidedAt']).toBeInstanceOf(Date);
    expect(again.body.code).toBe('PROPOSAL_NOT_PENDING');
  });

  it('foreign, unknown and malformed proposals', async () => {
    const owner = await fixture.chatUser();
    const other = await fixture.chatUser();
    const { messageId } = await answeredMessage(owner);
    const id = await seed(messageId, { kind: 'deck', payload: deckPayload([[FLEX, 2]]) });

    for (const action of ['apply', 'dismiss']) {
      await fixture.post(`/api/chat/proposals/${id}/${action}`, other.sessionToken).expect(404);
      await fixture.post(`/api/chat/proposals/${UNKNOWN_UUID}/${action}`, owner.sessionToken).expect(404);
      await fixture.post(`/api/chat/proposals/not-a-uuid/${action}`, owner.sessionToken).expect(400);
    }
    expect((await proposalRow(id))!['status']).toBe('pending');
  });

  it('an applied chat swap never raises the original prompt', async () => {
    const user = await fixture.chatUser();
    const { messageId } = await answeredMessage(user);
    const id = await seed(messageId, { kind: 'swap', payload: swapPayload(user), trackedDeckId: user.deckId });
    await fixture.post(`/api/chat/proposals/${id}/apply`, user.sessionToken).expect(201);
    await fixture.own(user.sessionToken, [{ cardIdentifier: FLEX, quantity: 4 }]);

    const detail = (await fixture.get(`/api/decks/${user.deckId}`, user.sessionToken).expect(200)).body;

    expect(detail.replacements.map((replacement: { originalCardIdentifier: string; originalOwned: boolean }) => [replacement.originalCardIdentifier, replacement.originalOwned])).toEqual([
      [FLEX, false],
    ]);
  });

  it('a chat swap reverts and the pick route refuses its origin', async () => {
    const user = await fixture.chatUser();
    const { messageId } = await answeredMessage(user);
    const id = await seed(messageId, { kind: 'swap', payload: swapPayload(user), trackedDeckId: user.deckId });
    const applied = await fixture.post(`/api/chat/proposals/${id}/apply`, user.sessionToken).expect(201);

    await fixture.post(`/api/replacements/${applied.body.replacementId}/revert`, user.sessionToken).expect(200);

    const cards = await fixture.deckCards(user.deckId);
    expect([cards[`${FLEX}@mainboard`], cards[`${COAX}@mainboard`]]).toEqual([2, undefined]);
    await fixture
      .post(`/api/decks/${user.deckId}/replacements`, user.sessionToken)
      .send({ originalCardIdentifier: EMISSARY, slot: 'mainboard', replacementCardIdentifier: COAX, pickedFrom: 'chat' })
      .expect(400);
  });

  it('logs apply, dismiss and stale', async () => {
    const log = jest.spyOn(Logger.prototype, 'log');
    const warn = jest.spyOn(Logger.prototype, 'warn');
    const user = await fixture.chatUser();
    const { messageId } = await answeredMessage(user);
    const applyId = await seed(messageId, { kind: 'deck', payload: deckPayload([[FLEX, 2]]) });
    const dismissId = await seed(messageId, { kind: 'deck', payload: deckPayload([[FLEX, 2]]) });
    const staleId = await seed(messageId, { kind: 'swap', payload: swapPayload(user), trackedDeckId: null });

    await fixture.post(`/api/chat/proposals/${applyId}/apply`, user.sessionToken).expect(201);
    await fixture.post(`/api/chat/proposals/${dismissId}/dismiss`, user.sessionToken).expect(200);
    await fixture.post(`/api/chat/proposals/${staleId}/apply`, user.sessionToken).expect(409);

    expect(log).toHaveBeenCalledWith(expect.objectContaining({ event: 'chat.proposal.applied', proposalId: applyId, kind: 'deck', userId: user.userId }));
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ event: 'chat.proposal.dismissed', proposalId: dismissId, kind: 'deck', userId: user.userId }));
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ event: 'chat.proposal.stale', proposalId: staleId, reason: 'DECK_GONE' }));
    log.mockRestore();
    warn.mockRestore();
  });

  it('deleting a conversation keeps usage and applied effects', async () => {
    const user = await fixture.chatUser();
    const { conversationId, messageId } = await answeredMessage(user);
    await fixture.dataSource.query(
      `INSERT INTO chat_usage ("userId", "messageId", model, "inputTokens", "outputTokens", "costUsd") VALUES ($1, $2, 'gemini-3.8-flash', 10, 10, 0.01)`,
      [user.userId, messageId],
    );
    const deckProposal = await seed(messageId, { kind: 'deck', payload: deckPayload([[FLEX, 2]], 'Kept deck') });
    const swapProposal = await seed(messageId, { kind: 'swap', payload: swapPayload(user), trackedDeckId: user.deckId });
    const createdDeck = (await fixture.post(`/api/chat/proposals/${deckProposal}/apply`, user.sessionToken).expect(201)).body.trackedDeckId as number;
    const replacementId = (await fixture.post(`/api/chat/proposals/${swapProposal}/apply`, user.sessionToken).expect(201)).body.replacementId as string;

    await fixture.del(`/api/chat/conversations/${conversationId}`, user.sessionToken).expect(204);

    expect(await count(`SELECT count(*)::int AS count FROM chat_conversation WHERE id = $1`, [conversationId])).toBe(0);
    expect(await count(`SELECT count(*)::int AS count FROM chat_message WHERE "conversationId" = $1`, [conversationId])).toBe(0);
    expect(await count(`SELECT count(*)::int AS count FROM chat_proposal WHERE id = ANY($1)`, [[deckProposal, swapProposal]])).toBe(0);
    const usage = (await fixture.dataSource.query(`SELECT "messageId" FROM chat_usage WHERE "userId" = $1`, [user.userId])) as Array<{ messageId: string | null }>;
    expect(usage).toEqual([{ messageId: null }]);
    expect(await count(`SELECT count(*)::int AS count FROM tracked_deck WHERE id = $1`, [createdDeck])).toBe(1);
    expect(await count(`SELECT count(*)::int AS count FROM card_replacement WHERE id = $1`, [replacementId])).toBe(1);
  });
});
