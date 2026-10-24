import request from 'supertest';
import { setChatAccess } from '../chat-grant';
import { TokenGeneratorService } from '../../auth/services/token-generator.service';
import { PASSWORD } from '../../replacements/__tests__/replacements-e2e.fixture';
import { bootChatFixture, IChatFixture } from './chat-e2e.fixture';

const SOME_UUID = '3f1d2c3b-4a5b-4c6d-8e7f-001122334455';

function routes(conversationId: string): Array<[string, string]> {
  return [
    ['get', '/api/chat/conversations'],
    ['post', '/api/chat/conversations'],
    ['get', `/api/chat/conversations/${conversationId}`],
    ['post', `/api/chat/conversations/${conversationId}/messages`],
    ['post', `/api/chat/conversations/${conversationId}/messages/${SOME_UUID}/retry`],
    ['delete', `/api/chat/conversations/${conversationId}`],
    ['get', '/api/chat/usage'],
    ['post', `/api/chat/proposals/${SOME_UUID}/apply`],
    ['post', `/api/chat/proposals/${SOME_UUID}/dismiss`],
  ];
}

describe('chat access (E2E)', () => {
  let fixture: IChatFixture;

  beforeAll(async () => {
    fixture = await bootChatFixture();
  }, 60_000);

  afterAll(async () => {
    await fixture.close();
  });

  function call(method: string, path: string, jwt: string): request.Test {
    const server = request(fixture.app.getHttpServer());
    const test = method === 'get' ? server.get(path) : method === 'delete' ? server.delete(path) : server.post(path);
    return test.set('Authorization', `Bearer ${jwt}`);
  }

  it('auth me reports the flag and a grant takes effect at once', async () => {
    const user = await fixture.chatUser({ access: false });
    const [row] = (await fixture.dataSource.query(`SELECT "chatAccess" FROM "user" WHERE email = $1`, [user.email])) as Array<{ chatAccess: boolean }>;
    expect(row!.chatAccess).toBe(false);
    expect((await fixture.get('/api/auth/me', user.jwt).expect(200)).body.chatAccess).toBe(false);

    await fixture.grant(user.email);

    expect((await fixture.get('/api/auth/me', user.jwt).expect(200)).body.chatAccess).toBe(true);
  });

  it('sign-in and verify-email return chatAccess over HTTP', async () => {
    const tokens = new TokenGeneratorService();
    const user = await fixture.chatUser({ access: false });
    const server = fixture.app.getHttpServer();
    const signIn = async (password: string) =>
      (await request(server).post('/api/auth/sign-in').send({ email: user.email, password }).expect(200)).body.user.chatAccess as boolean;

    const refused = await signIn(PASSWORD);
    await fixture.grant(user.email);
    const granted = await signIn(PASSWORD);

    const verifyToken = tokens.generateRawToken();
    await fixture.dataSource.query(
      `UPDATE "user" SET "verificationTokenHash" = $2, "verificationTokenExpiresAt" = now() + interval '1 hour' WHERE email = $1`,
      [user.email, tokens.hashToken(verifyToken)],
    );
    const verified = (await request(server).post('/api/auth/verify-email').send({ token: verifyToken }).expect(200)).body.user.chatAccess as boolean;

    expect([refused, granted, verified]).toEqual([false, true, true]);
  });

  it('every chat route refuses a user without access', async () => {
    const owner = await fixture.chatUser();
    const conversationId = await fixture.conversation(owner);
    const outsider = await fixture.chatUser({ access: false });

    const responses = await Promise.all(
      routes(conversationId).map(([method, path]) => call(method, path, outsider.jwt).send({ text: 'hello' })),
    );

    expect(responses.map((response) => [response.status, response.body.code])).toEqual(
      routes(conversationId).map(() => [403, 'CHAT_ACCESS_DENIED']),
    );
    const [{ count }] = (await fixture.dataSource.query(`SELECT count(*)::int AS count FROM chat_message WHERE "conversationId" = $1`, [
      conversationId,
    ])) as [{ count: number }];
    expect(count).toBe(0);
  });

  it('grant, revoke and an unknown email', async () => {
    const user = await fixture.chatUser({ access: false });
    const flag = async () =>
      ((await fixture.dataSource.query(`SELECT "chatAccess" FROM "user" WHERE email = $1`, [user.email])) as Array<{ chatAccess: boolean }>)[0]!
        .chatAccess;

    expect(await setChatAccess(fixture.dataSource, user.email.toUpperCase(), true)).toBe(user.email);
    expect(await flag()).toBe(true);
    await setChatAccess(fixture.dataSource, user.email, false);
    expect(await flag()).toBe(false);
    const [{ before }] = (await fixture.dataSource.query(`SELECT count(*) FILTER (WHERE "chatAccess")::int AS before FROM "user"`)) as [{ before: number }];
    await expect(setChatAccess(fixture.dataSource, 'nobody-here@test.local', true)).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
    const [{ after }] = (await fixture.dataSource.query(`SELECT count(*) FILTER (WHERE "chatAccess")::int AS after FROM "user"`)) as [{ after: number }];
    expect(after).toBe(before);
  });

  it('a revoke takes effect on the next request', async () => {
    const user = await fixture.chatUser();
    await fixture.get('/api/chat/conversations', user.jwt).expect(200);

    await fixture.grant(user.email, false);

    const refused = await fixture.get('/api/chat/conversations', user.jwt).expect(403);
    expect(refused.body.code).toBe('CHAT_ACCESS_DENIED');
  });

  it('every chat route requires a token', async () => {
    const all = [...routes(SOME_UUID), ['get', '/api/auth/me'] as [string, string]];
    const server = request(fixture.app.getHttpServer());

    const responses = await Promise.all(
      all.map(([method, path]) => (method === 'get' ? server.get(path) : method === 'delete' ? server.delete(path) : server.post(path))),
    );

    expect(responses.map((response) => response.status)).toEqual(all.map(() => 401));
  });
});
