import { bootChatFixture, COAX, FLEX, IChatFixture, KATSU } from './chat-e2e.fixture';

describe('chat schema (E2E)', () => {
  let fixture: IChatFixture;

  beforeAll(async () => {
    fixture = await bootChatFixture();
  }, 60_000);

  afterAll(async () => {
    await fixture.dataSource.query(`DELETE FROM tournament_deck WHERE "fabraryUlid" LIKE '01SCHEMA%'`);
    await fixture.dataSource.query(`DELETE FROM rules_entry WHERE "ruleNumber" LIKE 'schema-%'`);
    await fixture.close();
  });

  async function rejects(sql: string, params: unknown[] = []): Promise<void> {
    await expect(fixture.dataSource.query(sql, params)).rejects.toThrow();
  }

  async function count(sql: string, params: unknown[]): Promise<number> {
    const [{ count: value }] = (await fixture.dataSource.query(sql, params)) as [{ count: number }];
    return value;
  }

  it('enforces every one-way constraint', async () => {
    const user = await fixture.chatUser();
    const conversationId = await fixture.conversation(user, { trackedDeckId: user.deckId });
    const insertMessage = `INSERT INTO chat_message ("conversationId", role, status, locale) VALUES ($1, $2, $3, 'en-US') RETURNING id`;

    await rejects(insertMessage, [conversationId, 'system', 'done']);
    await rejects(insertMessage, [conversationId, 'assistant', 'queued']);
    await fixture.dataSource.query(insertMessage, [conversationId, 'assistant', 'pending']);
    await rejects(insertMessage, [conversationId, 'assistant', 'pending']);
    await rejects(insertMessage, [conversationId, 'assistant', 'running']);
    const [{ id: messageId }] = (await fixture.dataSource.query(insertMessage, [conversationId, 'assistant', 'done'])) as [{ id: string }];

    const insertProposal = `INSERT INTO chat_proposal ("messageId", kind, status, payload, reason, "trackedDeckId") VALUES ($1, $2, $3, '{}', 'r', $4) RETURNING id`;
    await rejects(insertProposal, [messageId, 'card', 'pending', null]);
    await rejects(insertProposal, [messageId, 'deck', 'open', null]);
    const [{ id: proposalId }] = (await fixture.dataSource.query(insertProposal, [messageId, 'swap', 'pending', user.deckId])) as [{ id: string }];
    await fixture.dataSource.query(
      `INSERT INTO chat_usage ("userId", "messageId", model, "inputTokens", "outputTokens", "costUsd") VALUES ($1, $2, 'gemini-3.8-flash', 1, 1, 0.000001)`,
      [user.userId, messageId],
    );
    const [{ id: replacementId }] = (await fixture.dataSource.query(
      `INSERT INTO card_replacement ("userId", "trackedDeckId", slot, "originalCardIdentifier", "replacementCardIdentifier", quantity, "pickedFrom", status)
       VALUES ($1, $2, 'mainboard', $3, $4, 1, 'chat', 'active') RETURNING id`,
      [user.userId, user.deckId, FLEX, COAX],
    )) as [{ id: string }];
    await rejects(
      `INSERT INTO card_replacement ("userId", "trackedDeckId", slot, "originalCardIdentifier", "replacementCardIdentifier", quantity, "pickedFrom", status)
       VALUES ($1, $2, 'mainboard', $3, $4, 1, 'oracle', 'active')`,
      [user.userId, user.deckId, FLEX, COAX],
    );
    await fixture.dataSource.query(`UPDATE chat_proposal SET "cardReplacementId" = $2 WHERE id = $1`, [proposalId, replacementId]);

    await fixture.del(`/api/decks/${user.deckId}/permanent`, user.sessionToken).expect((response) => expect(response.status).toBeLessThan(300));
    const [proposal] = (await fixture.dataSource.query(`SELECT "trackedDeckId", "cardReplacementId" FROM chat_proposal WHERE id = $1`, [proposalId])) as Array<Record<string, unknown>>;
    expect(proposal).toEqual({ trackedDeckId: null, cardReplacementId: null });
    expect(((await fixture.dataSource.query(`SELECT "trackedDeckId" FROM chat_conversation WHERE id = $1`, [conversationId])) as Array<Record<string, unknown>>)[0]).toEqual({
      trackedDeckId: null,
    });

    await fixture.dataSource.query(`DELETE FROM chat_conversation WHERE id = $1`, [conversationId]);
    expect(await count(`SELECT count(*)::int AS count FROM chat_message WHERE "conversationId" = $1`, [conversationId])).toBe(0);
    expect(await count(`SELECT count(*)::int AS count FROM chat_proposal WHERE id = $1`, [proposalId])).toBe(0);
    expect(((await fixture.dataSource.query(`SELECT "messageId" FROM chat_usage WHERE "userId" = $1`, [user.userId])) as Array<Record<string, unknown>>)).toEqual([
      { messageId: null },
    ]);

    const owner = await fixture.chatUser();
    const ownerConversation = await fixture.conversation(owner, { trackedDeckId: owner.deckId });
    const [{ id: ownerMessage }] = (await fixture.dataSource.query(insertMessage, [ownerConversation, 'assistant', 'done'])) as [{ id: string }];
    const [{ id: ownerReplacement }] = (await fixture.dataSource.query(
      `INSERT INTO card_replacement ("userId", "trackedDeckId", slot, "originalCardIdentifier", "replacementCardIdentifier", quantity, "pickedFrom", status)
       VALUES ($1, $2, 'mainboard', $3, $4, 1, 'chat', 'active') RETURNING id`,
      [owner.userId, owner.deckId, FLEX, COAX],
    )) as [{ id: string }];
    await fixture.dataSource.query(
      `INSERT INTO chat_proposal ("messageId", kind, status, payload, reason, "trackedDeckId", "cardReplacementId") VALUES ($1, 'swap', 'applied', '{}', 'r', $2, $3)`,
      [ownerMessage, owner.deckId, ownerReplacement],
    );
    await fixture.dataSource.query(
      `INSERT INTO chat_usage ("userId", "messageId", model, "inputTokens", "outputTokens", "costUsd") VALUES ($1, $2, 'gemini-3.8-flash', 1, 1, 0.000001)`,
      [owner.userId, ownerMessage],
    );
    await fixture.dataSource.query(`DELETE FROM "user" WHERE id = $1`, [owner.userId]);
    expect(await count(`SELECT count(*)::int AS count FROM chat_conversation WHERE "userId" = $1`, [owner.userId])).toBe(0);
    expect(await count(`SELECT count(*)::int AS count FROM chat_usage WHERE "userId" = $1`, [owner.userId])).toBe(0);

    const insertDeck = `INSERT INTO tournament_deck ("fabraryUlid", name, "heroIdentifier", format, "deckCreatedAt", "syncedAt") VALUES ($1, 'n', $2, 'Blitz', now(), now()) RETURNING id`;
    const [{ id: tournamentId }] = (await fixture.dataSource.query(insertDeck, ['01SCHEMA000000000000000001', KATSU])) as [{ id: string }];
    await rejects(insertDeck, ['01SCHEMA000000000000000001', KATSU]);
    await fixture.dataSource.query(`INSERT INTO tournament_deck_card ("tournamentDeckId", "cardIdentifier") VALUES ($1, $2)`, [tournamentId, FLEX]);
    await rejects(`INSERT INTO tournament_deck_card ("tournamentDeckId", "cardIdentifier") VALUES ($1, $2)`, [tournamentId, FLEX]);
    const insertRule = `INSERT INTO rules_entry ("ruleNumber", "sectionNumber", "sectionTitle", text, url, "sourceHash", "fetchedAt") VALUES ($1, '1.0', 't', 'x', 'u', 'h', now())`;
    await fixture.dataSource.query(insertRule, ['schema-1.0.1']);
    await rejects(insertRule, ['schema-1.0.1']);

    const fresh = await fixture.chatUser({ access: false });
    expect(((await fixture.dataSource.query(`SELECT "chatAccess" FROM "user" WHERE id = $1`, [fresh.userId])) as Array<Record<string, unknown>>)[0]).toEqual({
      chatAccess: false,
    });
  });
});
