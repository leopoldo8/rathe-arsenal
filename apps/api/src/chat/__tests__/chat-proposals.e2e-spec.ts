import { Logger } from '@nestjs/common';
import { bootChatFixture, COAX, EMISSARY, FLEX, IChatFixture, IChatUser, KATSU, TALISHAR } from './chat-e2e.fixture';

const ADRENALINE = 'adrenaline-rush-red';
const CC = 'Classic Constructed';
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

  it('proposals carry live owned and missing counts', async () => {
    const user = await fixture.chatUser();
    await fixture.own(user.jwt, [
      { cardIdentifier: EMISSARY, quantity: 4 },
      { cardIdentifier: FLEX, quantity: 3 },
      { cardIdentifier: COAX, quantity: 1 },
    ]);
    const { conversationId, messageId } = await answeredMessage(user);
    await seed(messageId, { kind: 'deck', payload: deckPayload([[EMISSARY, 2], [ADRENALINE, 3], [TALISHAR, 1]]) });
    await fixture.own(user.jwt, [{ cardIdentifier: ADRENALINE, quantity: 1 }]);
    await seed(messageId, { kind: 'swap', payload: swapPayload(user, COAX), trackedDeckId: user.deckId });
    await seed(messageId, { kind: 'swap', payload: swapPayload(user, 'brutal-assault-red'), trackedDeckId: user.deckId });

    const read = (await fixture.get(`/api/chat/conversations/${conversationId}`, user.jwt).expect(200)).body;
    const proposals = read.messages[1].proposals as Array<{ kind: string; ownedCount: number; missingCount: number }>;

    expect(proposals.map((proposal) => [proposal.kind, proposal.ownedCount, proposal.missingCount])).toEqual([
      ['deck', 3, 3],
      ['swap', 1, 0],
      ['swap', 0, 1],
    ]);
  });

  it('applying a deck proposal creates the deck with its cards', async () => {
    const user = await fixture.chatUser();
    const { messageId } = await answeredMessage(user);
    const id = await seed(messageId, { kind: 'deck', payload: deckPayload([[EMISSARY, 2], [FLEX, 3]], 'Chat Katsu tempo') });

    const applied = await fixture.post(`/api/chat/proposals/${id}/apply`, user.jwt).expect(201);

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

    const applied = await fixture.post(`/api/chat/proposals/${id}/apply`, user.jwt).expect(201);

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

    const responses = await Promise.all(ids.map((id) => fixture.post(`/api/chat/proposals/${id}/apply`, user.jwt)));

    expect(responses.map((response) => [response.status, response.body.code])).toEqual(ids.map(() => [409, 'PROPOSAL_NOT_PENDING']));
    expect([await decksOf(user), await replacementsOf(user)]).toEqual([decks, replacements]);
  });

  it('a proposal that no longer applies turns stale', async () => {
    const cutGone = await fixture.chatUser();
    const cutMessage = await answeredMessage(cutGone);
    const cutId = await seed(cutMessage.messageId, { kind: 'swap', payload: swapPayload(cutGone), trackedDeckId: cutGone.deckId });
    await fixture
      .put(`/api/decks/${cutGone.deckId}`, cutGone.jwt)
      .send({ heroIdentifier: KATSU, format: CC, cards: [{ cardIdentifier: EMISSARY, quantity: 2, slot: 'mainboard' }, { cardIdentifier: TALISHAR, quantity: 1, slot: 'weapon' }] })
      .expect(200);

    const deckGone = await fixture.chatUser();
    const goneMessage = await answeredMessage(deckGone);
    const goneId = await seed(goneMessage.messageId, { kind: 'swap', payload: swapPayload(deckGone), trackedDeckId: deckGone.deckId });
    await fixture.del(`/api/decks/${deckGone.deckId}`, deckGone.jwt).expect((response) => expect(response.status).toBeLessThan(300));

    const invalid = await fixture.chatUser();
    const invalidMessage = await answeredMessage(invalid);
    const invalidId = await seed(invalidMessage.messageId, { kind: 'deck', payload: deckPayload([['card-retired-from-catalog', 2]]) });
    const before = await Promise.all([cutGone, deckGone, invalid].map(async (user) => [await decksOf(user), await replacementsOf(user)]));

    const responses = await Promise.all([
      fixture.post(`/api/chat/proposals/${cutId}/apply`, cutGone.jwt),
      fixture.post(`/api/chat/proposals/${goneId}/apply`, deckGone.jwt),
      fixture.post(`/api/chat/proposals/${invalidId}/apply`, invalid.jwt),
    ]);

    expect(responses.map((response) => [response.status, response.body.code])).toEqual([
      [409, 'PROPOSAL_STALE'],
      [409, 'PROPOSAL_STALE'],
      [409, 'PROPOSAL_STALE'],
    ]);
    expect((await Promise.all([cutId, goneId, invalidId].map(proposalRow))).map((row) => row!['status'])).toEqual(['stale', 'stale', 'stale']);
    expect(await Promise.all([cutGone, deckGone, invalid].map(async (user) => [await decksOf(user), await replacementsOf(user)]))).toEqual(before);
  });

  it('concurrent applies create one effect', async () => {
    const user = await fixture.chatUser();
    const { messageId } = await answeredMessage(user);
    const deckId = await seed(messageId, { kind: 'deck', payload: deckPayload([[FLEX, 2]], 'Race deck') });
    const swapId = await seed(messageId, { kind: 'swap', payload: swapPayload(user), trackedDeckId: user.deckId });
    const decksBefore = await decksOf(user);

    const deckRace = await Promise.all([1, 2].map(() => fixture.post(`/api/chat/proposals/${deckId}/apply`, user.jwt)));
    const swapRace = await Promise.all([1, 2].map(() => fixture.post(`/api/chat/proposals/${swapId}/apply`, user.jwt)));

    expect(deckRace.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(swapRace.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await decksOf(user)).toBe(decksBefore + 1);
    expect(await replacementsOf(user)).toBe(1);
  });

  it('dismiss closes a pending proposal', async () => {
    const user = await fixture.chatUser();
    const { messageId } = await answeredMessage(user);
    const id = await seed(messageId, { kind: 'deck', payload: deckPayload([[FLEX, 2]]) });

    const dismissed = await fixture.post(`/api/chat/proposals/${id}/dismiss`, user.jwt).expect(200);
    const again = await fixture.post(`/api/chat/proposals/${id}/dismiss`, user.jwt).expect(409);

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
      await fixture.post(`/api/chat/proposals/${id}/${action}`, other.jwt).expect(404);
      await fixture.post(`/api/chat/proposals/${UNKNOWN_UUID}/${action}`, owner.jwt).expect(404);
      await fixture.post(`/api/chat/proposals/not-a-uuid/${action}`, owner.jwt).expect(400);
    }
    expect((await proposalRow(id))!['status']).toBe('pending');
  });

  it('an applied chat swap never raises the original prompt', async () => {
    const user = await fixture.chatUser();
    const { messageId } = await answeredMessage(user);
    const id = await seed(messageId, { kind: 'swap', payload: swapPayload(user), trackedDeckId: user.deckId });
    await fixture.post(`/api/chat/proposals/${id}/apply`, user.jwt).expect(201);
    await fixture.own(user.jwt, [{ cardIdentifier: FLEX, quantity: 4 }]);

    const detail = (await fixture.get(`/api/decks/${user.deckId}`, user.jwt).expect(200)).body;

    expect(detail.replacements.map((replacement: { originalCardIdentifier: string; originalOwned: boolean }) => [replacement.originalCardIdentifier, replacement.originalOwned])).toEqual([
      [FLEX, false],
    ]);
  });

  it('a chat swap reverts and the pick route refuses its origin', async () => {
    const user = await fixture.chatUser();
    const { messageId } = await answeredMessage(user);
    const id = await seed(messageId, { kind: 'swap', payload: swapPayload(user), trackedDeckId: user.deckId });
    const applied = await fixture.post(`/api/chat/proposals/${id}/apply`, user.jwt).expect(201);

    await fixture.post(`/api/replacements/${applied.body.replacementId}/revert`, user.jwt).expect(200);

    const cards = await fixture.deckCards(user.deckId);
    expect([cards[`${FLEX}@mainboard`], cards[`${COAX}@mainboard`]]).toEqual([2, undefined]);
    await fixture
      .post(`/api/decks/${user.deckId}/replacements`, user.jwt)
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

    await fixture.post(`/api/chat/proposals/${applyId}/apply`, user.jwt).expect(201);
    await fixture.post(`/api/chat/proposals/${dismissId}/dismiss`, user.jwt).expect(200);
    await fixture.post(`/api/chat/proposals/${staleId}/apply`, user.jwt).expect(409);

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
    const createdDeck = (await fixture.post(`/api/chat/proposals/${deckProposal}/apply`, user.jwt).expect(201)).body.trackedDeckId as number;
    const replacementId = (await fixture.post(`/api/chat/proposals/${swapProposal}/apply`, user.jwt).expect(201)).body.replacementId as string;

    await fixture.del(`/api/chat/conversations/${conversationId}`, user.jwt).expect(204);

    expect(await count(`SELECT count(*)::int AS count FROM chat_conversation WHERE id = $1`, [conversationId])).toBe(0);
    expect(await count(`SELECT count(*)::int AS count FROM chat_message WHERE "conversationId" = $1`, [conversationId])).toBe(0);
    expect(await count(`SELECT count(*)::int AS count FROM chat_proposal WHERE id = ANY($1)`, [[deckProposal, swapProposal]])).toBe(0);
    const usage = (await fixture.dataSource.query(`SELECT "messageId" FROM chat_usage WHERE "userId" = $1`, [user.userId])) as Array<{ messageId: string | null }>;
    expect(usage).toEqual([{ messageId: null }]);
    expect(await count(`SELECT count(*)::int AS count FROM tracked_deck WHERE id = $1`, [createdDeck])).toBe(1);
    expect(await count(`SELECT count(*)::int AS count FROM card_replacement WHERE id = $1`, [replacementId])).toBe(1);
  });
});
