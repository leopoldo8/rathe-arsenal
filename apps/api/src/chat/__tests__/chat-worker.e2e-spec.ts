import { Logger } from '@nestjs/common';
import { ChatTurnQueueService } from '../chat-turn-queue.service';
import { CHAT_TOOL_DECLARATIONS } from '../chat-tools';
import { bootChatFixture, callAnswer, COAX, FLEX, IChatFixture, IChatUser, KATSU, EMISSARY, scriptedFetch, textAnswer } from './chat-e2e.fixture';

describe('chat worker (E2E)', () => {
  let fixture: IChatFixture;
  let queue: ChatTurnQueueService;

  beforeAll(async () => {
    fixture = await bootChatFixture();
    queue = fixture.app.get(ChatTurnQueueService);
  }, 60_000);

  afterAll(async () => {
    await fixture.close();
  });

  beforeEach(async () => {
    await fixture.dataSource.query(`UPDATE chat_message SET status = 'failed', error = 'WORKER_LOST' WHERE status IN ('pending', 'running')`);
  });

  async function turn(text = 'How do others build Katsu?'): Promise<{ user: IChatUser; conversationId: string; userMessageId: string; assistantMessageId: string }> {
    const user = await fixture.chatUser();
    const conversationId = await fixture.conversation(user, { trackedDeckId: user.deckId });
    return { user, conversationId, ...(await fixture.send(user, conversationId, text)) };
  }

  async function usageRows(messageId: string): Promise<Array<{ inputTokens: number; outputTokens: number; costUsd: string; messageId: string | null }>> {
    return fixture.dataSource.query(`SELECT "inputTokens", "outputTokens", "costUsd", "messageId" FROM chat_usage WHERE "messageId" = $1 ORDER BY "createdAt"`, [messageId]);
  }

  it('claims the oldest pending turn', async () => {
    expect(await queue.claimNext()).toBeNull();
    const first = await turn('first');
    await turn('second');

    const claimed = await queue.claimNext();

    expect(claimed?.id).toBe(first.assistantMessageId);
    const row = await fixture.message(first.assistantMessageId);
    expect([row['status'], row['attempts']]).toEqual(['running', 1]);
    expect(row['claimedAt']).toBeInstanceOf(Date);
    expect(row['startedAt']).toBeInstanceOf(Date);
  });

  it('a turn over budget fails without a call', async () => {
    const { user, assistantMessageId } = await turn();
    await fixture.seedUsage(user.userId, 5);
    const stub = scriptedFetch([textAnswer('never')]);

    await fixture.drain(stub.fetch);

    const overBudget = await fixture.message(assistantMessageId);
    expect([overBudget['status'], overBudget['error']]).toEqual(['failed', 'BUDGET_EXHAUSTED']);
    expect(stub.requests).toHaveLength(0);
  });

  it('a missing key fails without a call', async () => {
    for (const key of [null, '  ']) {
      const { assistantMessageId } = await turn();
      const stub = scriptedFetch([textAnswer('never')]);

      await fixture.drain(stub.fetch, key);

      const row = await fixture.message(assistantMessageId);
      expect([row['status'], row['error']]).toEqual(['failed', 'NO_API_KEY']);
      expect(stub.requests).toHaveLength(0);
    }
  });

  it('declares the twelve tools', async () => {
    await turn();
    const stub = scriptedFetch([textAnswer('Hello')]);

    await fixture.drain(stub.fetch);

    const declarations = stub.requests[0]!.tools[0]!.functionDeclarations;
    expect(declarations.map((tool) => tool.name)).toEqual([
      'get_deck',
      'get_owned_copies',
      'search_cards',
      'get_recommendations',
      'search_tournament_decks',
      'get_community_decks',
      'get_tournament_meta',
      'get_collection',
      'get_tournament_deck',
      'search_rules',
      'propose_deck',
      'propose_swap',
    ]);
    expect(declarations.map((tool) => tool.parametersJsonSchema.type)).toEqual(CHAT_TOOL_DECLARATIONS.map(() => 'object'));
  });

  it('answers every call in one turn and replays the model content', async () => {
    const { user, assistantMessageId } = await turn();
    const first = callAnswer([
      { id: 'c1', name: 'get_deck', args: { deckId: user.deckId } },
      { id: 'c2', name: 'search_rules', args: { query: 'go again' } },
    ]);
    const second = callAnswer([{ id: 'c3', name: 'get_owned_copies', args: { cardIdentifiers: [FLEX] } }]);
    const stub = scriptedFetch([first, second, textAnswer('Katsu runs Flex.')]);

    await fixture.drain(stub.fetch);

    const secondRequest = stub.requests[1]!.contents;
    const firstModel = (first as { candidates: Array<{ content: unknown }> }).candidates[0]!.content;
    expect(secondRequest[secondRequest.length - 2]).toEqual(firstModel);
    const responses = secondRequest[secondRequest.length - 1]!;
    expect(responses.role).toBe('user');
    expect(responses.parts.map((part) => [(part['functionResponse'] as { name: string }).name, (part['functionResponse'] as { id: string }).id])).toEqual([
      ['get_deck', 'c1'],
      ['search_rules', 'c2'],
    ]);
    expect(stub.requests).toHaveLength(3);
    expect((await fixture.message(assistantMessageId))['text']).toBe('Katsu runs Flex.');
  });

  it('a text answer ends the turn done with summed usage', async () => {
    const { user, assistantMessageId } = await turn();
    const final = {
      candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ text: 'weighing options', thought: true }, { text: 'Play Flex.' }] } }],
      usageMetadata: { promptTokenCount: 10_000, candidatesTokenCount: 200, thoughtsTokenCount: 800 },
    };
    const stub = scriptedFetch([callAnswer([{ id: 'c1', name: 'get_deck', args: { deckId: user.deckId } }]), final]);

    await fixture.drain(stub.fetch);

    const row = await fixture.message(assistantMessageId);
    expect([row['status'], row['text'], row['model']]).toEqual(['done', 'Play Flex.', 'gemini-3.8-flash']);
    expect([row['inputTokens'], row['outputTokens']]).toEqual([40_000 + 10_000, 4_000 + 1_000]);
    const expectedCost = (50_000 * 0.75 + 5_000 * 3.75) / 1e6;
    expect(Number(row['costUsd'])).toBeCloseTo(expectedCost, 6);
    expect((row['modelContent'] as unknown[]).length).toBe(3);
  });

  it('every model call writes one usage row', async () => {
    const { user, assistantMessageId } = await turn();
    const stub = scriptedFetch([callAnswer([{ id: 'c1', name: 'get_deck', args: { deckId: user.deckId } }]), textAnswer('done')]);

    await fixture.drain(stub.fetch);

    const rows = await usageRows(assistantMessageId);
    expect(rows.map((row) => [row.inputTokens, row.outputTokens])).toEqual([
      [40_000, 4_000],
      [40_000, 4_000],
    ]);
    expect(rows.map((row) => Number(row.costUsd))).toEqual([0.045, 0.045]);
  });

  it('the fifth call declares no tool and its answer ends the turn', async () => {
    const { user, assistantMessageId } = await turn();
    const lookup = callAnswer([{ name: 'get_deck', args: { deckId: user.deckId } }]);
    const stub = scriptedFetch([lookup, lookup, lookup, lookup, textAnswer('From what I found.')]);

    await fixture.drain(stub.fetch);

    const row = await fixture.message(assistantMessageId);
    expect([row['status'], row['text']]).toEqual(['done', 'From what I found.']);
    expect(stub.requests.map((request) => 'tools' in request)).toEqual([...Array(4).fill(true), false]);
  });

  it('a model that still asks for a tool on the final call and its retry fails the turn', async () => {
    const { user, assistantMessageId } = await turn();
    const stub = scriptedFetch([callAnswer([{ name: 'get_deck', args: { deckId: user.deckId } }])]);

    await fixture.drain(stub.fetch);

    const capped = await fixture.message(assistantMessageId);
    expect([capped['status'], capped['error']]).toEqual(['failed', 'TOO_MANY_TOOL_ROUNDS']);
    expect(stub.requests).toHaveLength(6);
  });

  it('a provider error fails the turn and keeps the user message', async () => {
    const { userMessageId, assistantMessageId } = await turn();

    await fixture.drain(scriptedFetch([503]).fetch);

    const row = await fixture.message(assistantMessageId);
    expect([row['status'], row['error']]).toEqual(['failed', 'PROVIDER_UNAVAILABLE']);
    expect((await fixture.message(userMessageId))['status']).toBe('done');
    expect(fixture.slept).toEqual([2_000, 5_000, 10_000]);
  });

  it('an overloaded model is called again and the turn still answers', async () => {
    const log = jest.spyOn(Logger.prototype, 'log');
    const { assistantMessageId } = await turn();
    const stub = scriptedFetch([503, 429, textAnswer('ok')]);

    await fixture.drain(stub.fetch);

    const row = await fixture.message(assistantMessageId);
    expect([row['status'], row['text']]).toEqual(['done', 'ok']);
    expect(stub.requests).toHaveLength(3);
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ event: 'chat.turn.retry', attempt: 1, code: 'PROVIDER_UNAVAILABLE', delayMs: 2_000 }));
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ event: 'chat.turn.retry', attempt: 2, code: 'RATE_LIMITED', delayMs: 5_000 }));
    log.mockRestore();
  });

  it('a failed turn keeps usage and stores no proposal', async () => {
    const { userMessageId, assistantMessageId } = await turn();
    const proposal = { name: 'Katsu tempo', heroIdentifier: KATSU, format: 'Classic Constructed', cards: [{ cardIdentifier: FLEX, quantity: 2, slot: 'mainboard' }], reason: 'fast' };

    await fixture.drain(scriptedFetch([callAnswer([{ id: 'p1', name: 'propose_deck', args: proposal }]), 503]).fetch);

    expect((await fixture.message(assistantMessageId))['status']).toBe('failed');
    expect(await usageRows(assistantMessageId)).toHaveLength(1);
    const proposals = await fixture.dataSource.query(`SELECT id FROM chat_proposal WHERE "messageId" = $1`, [assistantMessageId]);
    expect(proposals).toEqual([]);
    expect((await fixture.message(userMessageId))['status']).toBe('done');
  });

  it('reclaims orphaned turns after 10 minutes', async () => {
    const stale = await turn('stale');
    const exhausted = await turn('exhausted');
    const fresh = await turn('fresh');
    const claimedAgo = (id: string, minutes: number, attempts: number) =>
      fixture.dataSource.query(`UPDATE chat_message SET status = 'running', attempts = $3, "claimedAt" = now() - ($2 || ' minutes')::interval WHERE id = $1`, [
        id,
        String(minutes),
        attempts,
      ]);
    await claimedAgo(stale.assistantMessageId, 11, 1);
    await claimedAgo(exhausted.assistantMessageId, 11, 3);
    await claimedAgo(fresh.assistantMessageId, 9, 1);

    await queue.reclaimOrphans();

    const rows = await Promise.all([stale, exhausted, fresh].map((entry) => fixture.message(entry.assistantMessageId)));
    expect(rows.map((row) => [row['status'], row['error'], row['claimedAt'] === null])).toEqual([
      ['pending', null, true],
      ['failed', 'WORKER_LOST', false],
      ['running', null, false],
    ]);
  });

  it('each call refreshes claimedAt', async () => {
    const { user, assistantMessageId } = await turn();
    const seen: Date[] = [];
    const script = scriptedFetch([callAnswer([{ id: 'c1', name: 'get_deck', args: { deckId: user.deckId } }]), textAnswer('ok')]);
    const fetch: typeof script.fetch = async (url, init) => {
      seen.push((await fixture.message(assistantMessageId))['claimedAt'] as Date);
      await new Promise((resolve) => setTimeout(resolve, 20));
      return script.fetch(url, init);
    };

    await fixture.drain(fetch);

    expect((await fixture.message(assistantMessageId))['status']).toBe('done');
    expect(seen).toHaveLength(2);
    expect(seen[1]!.getTime()).toBeGreaterThan(seen[0]!.getTime());
  });

  it('logs each turn transition', async () => {
    const log = jest.spyOn(Logger.prototype, 'log');
    const warn = jest.spyOn(Logger.prototype, 'warn');
    const { user } = await turn();
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ event: 'chat.message.sent' }));

    await fixture.drain(scriptedFetch([callAnswer([{ id: 'c1', name: 'get_deck', args: { deckId: user.deckId } }]), textAnswer('ok')]).fetch);
    await turn();
    await fixture.drain(scriptedFetch([{ promptFeedback: { blockReason: 'SAFETY' } }]).fetch);

    expect(log).toHaveBeenCalledWith(expect.objectContaining({ event: 'chat.turn.claimed' }));
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ event: 'chat.turn.tool', tool: 'get_deck', durationMs: expect.any(Number) }));
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'chat.turn.done',
        rounds: 2,
        proposals: 0,
        inputTokens: 80_000,
        outputTokens: 8_000,
        costUsd: expect.any(Number),
        durationMs: expect.any(Number),
      }),
    );
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ event: 'chat.turn.failed', code: 'MODEL_REFUSED', attempts: 1 }));
    log.mockRestore();
    warn.mockRestore();
  });

  it('stores the valid proposals with the answer', async () => {
    const { user, assistantMessageId } = await turn();
    const valid = { name: 'Katsu tempo', heroIdentifier: KATSU, format: 'Classic Constructed', cards: [{ cardIdentifier: FLEX, quantity: 2, slot: 'mainboard' }, { cardIdentifier: EMISSARY, quantity: 2, slot: 'mainboard' }], reason: 'tempo list' };
    const invalid = { ...valid, cards: [{ cardIdentifier: 'not-a-card', quantity: 1, slot: 'mainboard' }] };
    const swap = { deckId: user.deckId, originalCardIdentifier: FLEX, slot: 'mainboard', replacementCardIdentifier: COAX, reason: 'more value' };
    const stub = scriptedFetch([
      callAnswer([
        { id: 'p1', name: 'propose_deck', args: valid },
        { id: 'p2', name: 'propose_deck', args: invalid },
        { id: 'p3', name: 'propose_swap', args: swap },
      ]),
      textAnswer('Two ideas for you.'),
    ]);

    await fixture.drain(stub.fetch);

    const proposals = (await fixture.dataSource.query(
      `SELECT kind, status, reason, "trackedDeckId" FROM chat_proposal WHERE "messageId" = $1 ORDER BY kind`,
      [assistantMessageId],
    )) as Array<Record<string, unknown>>;
    expect(proposals).toEqual([
      { kind: 'deck', status: 'pending', reason: 'tempo list', trackedDeckId: null },
      { kind: 'swap', status: 'pending', reason: 'more value', trackedDeckId: user.deckId },
    ]);
    const responses = stub.requests[1]!.contents[stub.requests[1]!.contents.length - 1]!.parts.map(
      (part) => (part['functionResponse'] as { response: Record<string, unknown> }).response,
    );
    expect(responses).toEqual([{ ok: true }, expect.objectContaining({ ok: false, error: 'CARD_UNKNOWN' }), { ok: true }]);
  });

  it('a turn through OpenRouter replays its tool round, records the model and the cost OpenRouter charged', async () => {
    const { assistantMessageId } = await turn();
    const usage = { prompt_tokens: 5_000, completion_tokens: 200, prompt_tokens_details: { cached_tokens: 3_000 }, cost: 0.0007 };
    const urls: string[] = [];
    const stub = scriptedFetch([
      {
        choices: [
          {
            finish_reason: 'tool_calls',
            message: { content: null, tool_calls: [{ id: 'or-1', type: 'function', function: { name: 'search_cards', arguments: '{"query":"flex"}' } }] },
          },
        ],
        usage,
      },
      { choices: [{ finish_reason: 'stop', message: { content: 'Flex is a Guardian card.' } }], usage },
    ]);

    await fixture.drain(async (url, init) => (urls.push(url), stub.fetch(url, init)), 'or-key', 'anthropic/claude-haiku-5.5');

    const message = await fixture.message(assistantMessageId);
    expect([message['status'], message['text'], message['model']]).toEqual(['done', 'Flex is a Guardian card.', 'anthropic/claude-haiku-5.5']);
    expect(urls.every((url) => url.startsWith('https://openrouter.ai/'))).toBe(true);
    const second = stub.requests[1] as unknown as { model: string; messages: Array<Record<string, unknown>> };
    expect(second.model).toBe('anthropic/claude-haiku-5.5');
    expect(second.messages.slice(-2)).toEqual([
      { role: 'assistant', content: null, tool_calls: [{ id: 'or-1', type: 'function', function: { name: 'search_cards', arguments: '{"query":"flex"}' } }] },
      { role: 'tool', tool_call_id: 'or-1', content: expect.stringContaining('flex') },
    ]);
    const rows = (await fixture.dataSource.query(
      `SELECT model, "inputTokens", "cachedInputTokens", "costUsd" FROM chat_usage WHERE "messageId" = $1 ORDER BY "createdAt"`,
      [assistantMessageId],
    )) as Array<Record<string, unknown>>;
    expect(rows).toEqual([
      { model: 'anthropic/claude-haiku-5.5', inputTokens: 5_000, cachedInputTokens: 3_000, costUsd: '0.000700' },
      { model: 'anthropic/claude-haiku-5.5', inputTokens: 5_000, cachedInputTokens: 3_000, costUsd: '0.000700' },
    ]);
  });
});
