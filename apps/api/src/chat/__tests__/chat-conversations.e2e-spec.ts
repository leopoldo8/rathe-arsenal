import { bootChatFixture, IChatFixture } from './chat-e2e.fixture';

function nextMonthStart(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

function lastMonth(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15));
}

describe('chat conversations (E2E)', () => {
  let fixture: IChatFixture;

  beforeAll(async () => {
    fixture = await bootChatFixture();
  }, 60_000);

  afterAll(async () => {
    await fixture.close();
  });

  async function messageCount(conversationId: string): Promise<number> {
    const [{ count }] = (await fixture.dataSource.query(`SELECT count(*)::int AS count FROM chat_message WHERE "conversationId" = $1`, [
      conversationId,
    ])) as [{ count: number }];
    return count;
  }

  it('lists own conversations newest first', async () => {
    const user = await fixture.chatUser();
    const other = await fixture.chatUser();
    await fixture.conversation(other);
    expect((await fixture.get('/api/chat/conversations', user.sessionToken).expect(200)).body).toEqual([]);

    const first = await fixture.conversation(user);
    const second = await fixture.conversation(user);
    await fixture.send(user, first, 'bump the first');

    const listed = (await fixture.get('/api/chat/conversations', user.sessionToken).expect(200)).body as Array<Record<string, unknown>>;
    expect(listed.map((row) => row['id'])).toEqual([first, second]);
    expect(Object.keys(listed[0]!).sort()).toEqual(['id', 'title', 'trackedDeckId', 'updatedAt']);
  });

  it('creates unbound or bound to an owned deck', async () => {
    const user = await fixture.chatUser();
    const other = await fixture.chatUser();

    const unbound = await fixture.post('/api/chat/conversations', user.sessionToken).send({}).expect(201);
    const bound = await fixture.post('/api/chat/conversations', user.sessionToken).send({ trackedDeckId: user.deckId }).expect(201);
    await fixture.post('/api/chat/conversations', user.sessionToken).send({ trackedDeckId: other.deckId }).expect(404);
    await fixture.post('/api/chat/conversations', user.sessionToken).send({ trackedDeckId: 2_000_000_000 }).expect(404);
    await fixture.post('/api/chat/conversations', user.sessionToken).send({ trackedDeckId: 'abc' }).expect(400);

    expect((await fixture.get(`/api/chat/conversations/${unbound.body.id}`, user.sessionToken).expect(200)).body.trackedDeckId).toBeNull();
    expect((await fixture.get(`/api/chat/conversations/${bound.body.id}`, user.sessionToken).expect(200)).body.trackedDeckId).toBe(user.deckId);
  });

  it('send stores the user message and a pending turn', async () => {
    const user = await fixture.chatUser();
    const conversationId = await fixture.conversation(user);

    const ids = await fixture.send(user, conversationId, 'How do others build Katsu?', 'en-US');

    const userMessage = await fixture.message(ids.userMessageId);
    const assistant = await fixture.message(ids.assistantMessageId);
    expect([userMessage['role'], userMessage['status'], userMessage['text']]).toEqual(['user', 'done', 'How do others build Katsu?']);
    expect([assistant['role'], assistant['status'], assistant['locale']]).toEqual(['assistant', 'pending', 'en-US']);
    const read = (await fixture.get(`/api/chat/conversations/${conversationId}`, user.sessionToken).expect(200)).body;
    expect(read.title).toBe('How do others build Katsu?');

    const long = await fixture.conversation(user);
    await fixture.send(user, long, 'k'.repeat(100));
    await fixture.dataSource.query(`UPDATE chat_message SET status = 'done' WHERE "conversationId" = $1`, [long]);
    await fixture.send(user, long, 'second message');
    const longRead = (await fixture.get(`/api/chat/conversations/${long}`, user.sessionToken).expect(200)).body;
    expect(longRead.title).toBe('k'.repeat(80));
  });

  it('one open turn per conversation', async () => {
    const user = await fixture.chatUser();
    const conversationId = await fixture.conversation(user);
    const { assistantMessageId } = await fixture.send(user, conversationId, 'first');

    const whilePending = await fixture.post(`/api/chat/conversations/${conversationId}/messages`, user.sessionToken).send({ text: 'again' }).expect(409);
    await fixture.dataSource.query(`UPDATE chat_message SET status = 'running' WHERE id = $1`, [assistantMessageId]);
    const whileRunning = await fixture.post(`/api/chat/conversations/${conversationId}/messages`, user.sessionToken).send({ text: 'again' }).expect(409);

    expect([whilePending.body.code, whileRunning.body.code]).toEqual(['CHAT_TURN_IN_PROGRESS', 'CHAT_TURN_IN_PROGRESS']);
    expect(await messageCount(conversationId)).toBe(2);

    const idle = await fixture.conversation(user);
    const raced = await Promise.all([
      fixture.post(`/api/chat/conversations/${idle}/messages`, user.sessionToken).send({ text: 'one' }),
      fixture.post(`/api/chat/conversations/${idle}/messages`, user.sessionToken).send({ text: 'two' }),
    ]);
    expect(raced.map((response) => response.status).sort()).toEqual([202, 409]);
    expect(await messageCount(idle)).toBe(2);
  });

  it('the monthly budget refuses a send', async () => {
    const user = await fixture.chatUser();
    const conversationId = await fixture.conversation(user);
    await fixture.seedUsage(user.userId, 5, lastMonth());
    await fixture.seedUsage(user.userId, 4.99);

    await fixture.post(`/api/chat/conversations/${conversationId}/messages`, user.sessionToken).send({ text: 'still fine' }).expect(202);
    await fixture.dataSource.query(`UPDATE chat_message SET status = 'done' WHERE "conversationId" = $1`, [conversationId]);
    await fixture.seedUsage(user.userId, 0.01);
    const before = await messageCount(conversationId);

    const refused = await fixture.post(`/api/chat/conversations/${conversationId}/messages`, user.sessionToken).send({ text: 'over' }).expect(429);

    expect(refused.body.code).toBe('CHAT_BUDGET_EXHAUSTED');
    expect(refused.body.details).toEqual({ resetsAt: nextMonthStart() });
    expect(await messageCount(conversationId)).toBe(before);
  });

  it('refuses empty and oversized messages', async () => {
    const user = await fixture.chatUser();
    const conversationId = await fixture.conversation(user);
    const path = `/api/chat/conversations/${conversationId}/messages`;

    for (const body of [{ text: '' }, { text: '   ' }, { text: 'a'.repeat(4001) }, {}]) {
      await fixture.post(path, user.sessionToken).send(body).expect(400);
    }
    expect(await messageCount(conversationId)).toBe(0);
    await fixture.post(path, user.sessionToken).send({ text: 'a'.repeat(4000) }).expect(202);
  });

  it('reads messages oldest first', async () => {
    const user = await fixture.chatUser();
    const conversationId = await fixture.conversation(user);
    const first = await fixture.send(user, conversationId, 'first');
    await fixture.dataSource.query(`UPDATE chat_message SET status = 'done', text = 'answer' WHERE id = $1`, [first.assistantMessageId]);
    const second = await fixture.send(user, conversationId, 'second');

    const read = (await fixture.get(`/api/chat/conversations/${conversationId}`, user.sessionToken).expect(200)).body;

    expect(read.messages.map((message: { id: string }) => message.id)).toEqual([
      first.userMessageId,
      first.assistantMessageId,
      second.userMessageId,
      second.assistantMessageId,
    ]);
    expect(Object.keys(read.messages[0]).sort()).toEqual(['createdAt', 'error', 'id', 'proposals', 'role', 'status', 'text']);
  });

  it('retry reopens only a failed turn', async () => {
    const user = await fixture.chatUser();
    const conversationId = await fixture.conversation(user);
    const { userMessageId, assistantMessageId } = await fixture.send(user, conversationId, 'hello');
    const retryPath = (id: string) => `/api/chat/conversations/${conversationId}/messages/${id}/retry`;
    await fixture.dataSource.query(`UPDATE chat_message SET status = 'failed', error = 'RATE_LIMITED' WHERE id = $1`, [assistantMessageId]);

    await fixture.post(retryPath(assistantMessageId), user.sessionToken).expect(202);
    const reopened = await fixture.message(assistantMessageId);
    expect([reopened['status'], reopened['error']]).toEqual(['pending', null]);

    await fixture.dataSource.query(`UPDATE chat_message SET status = 'done' WHERE id = $1`, [assistantMessageId]);
    expect((await fixture.post(retryPath(assistantMessageId), user.sessionToken).expect(409)).body.code).toBe('MESSAGE_NOT_RETRYABLE');
    expect((await fixture.post(retryPath(userMessageId), user.sessionToken).expect(409)).body.code).toBe('MESSAGE_NOT_RETRYABLE');

    await fixture.dataSource.query(`UPDATE chat_message SET status = 'failed' WHERE id = $1`, [assistantMessageId]);
    await fixture.seedUsage(user.userId, 5);
    expect((await fixture.post(retryPath(assistantMessageId), user.sessionToken).expect(429)).body.code).toBe('CHAT_BUDGET_EXHAUSTED');
  });

  it('foreign and malformed conversations', async () => {
    const owner = await fixture.chatUser();
    const other = await fixture.chatUser();
    const conversationId = await fixture.conversation(owner);
    const { assistantMessageId } = await fixture.send(owner, conversationId, 'mine');
    const base = `/api/chat/conversations/${conversationId}`;

    await fixture.get(base, other.sessionToken).expect(404);
    await fixture.post(`${base}/messages`, other.sessionToken).send({ text: 'x' }).expect(404);
    await fixture.post(`${base}/messages/${assistantMessageId}/retry`, other.sessionToken).expect(404);
    await fixture.del(base, other.sessionToken).expect(404);
    await fixture.get('/api/chat/conversations/not-a-uuid', owner.sessionToken).expect(400);
    await fixture.post('/api/chat/conversations/not-a-uuid/messages', owner.sessionToken).send({ text: 'x' }).expect(400);
    await fixture.post(`${base}/messages/not-a-uuid/retry`, owner.sessionToken).expect(400);
    await fixture.del('/api/chat/conversations/not-a-uuid', owner.sessionToken).expect(400);
    expect(await messageCount(conversationId)).toBe(2);
  });

  it('a deleted deck unbinds the conversation', async () => {
    const user = await fixture.chatUser();
    const conversationId = await fixture.conversation(user, { trackedDeckId: user.deckId });

    await fixture.del(`/api/decks/${user.deckId}`, user.sessionToken).expect((response) => expect(response.status).toBeLessThan(300));

    const read = (await fixture.get(`/api/chat/conversations/${conversationId}`, user.sessionToken).expect(200)).body;
    expect(read.trackedDeckId).toBeNull();
  });

  it('usage sums this month only', async () => {
    const user = await fixture.chatUser();
    await fixture.seedUsage(user.userId, 1);
    await fixture.seedUsage(user.userId, 0.25);
    await fixture.seedUsage(user.userId, 3, lastMonth());

    const usage = (await fixture.get('/api/chat/usage', user.sessionToken).expect(200)).body;

    expect(usage).toEqual({ spentUsd: 1.25, budgetUsd: 5, resetsAt: nextMonthStart() });
  });
});
