import request from 'supertest';
import { bootChatFixture, IChatFixture } from './chat-e2e.fixture';

const SOME_UUID = '3f1d2c3b-4a5b-4c6d-8e7f-001122334455';

describe('chat throttle (E2E)', () => {
  let fixture: IChatFixture;

  beforeAll(async () => {
    fixture = await bootChatFixture({ throttle: true });
  }, 60_000);

  afterAll(async () => {
    await fixture.close();
  });

  it('send and retry allow 20 a minute', async () => {
    const user = await fixture.chatUser();
    const conversationId = await fixture.conversation(user);
    const send = () => fixture.post(`/api/chat/conversations/${conversationId}/messages`, user.jwt).send({ text: 'hi' });
    const retry = () => fixture.post(`/api/chat/conversations/${conversationId}/messages/${SOME_UUID}/retry`, user.jwt);

    const sends: number[] = [];
    for (let i = 0; i < 21; i += 1) sends.push((await send()).status);
    const retries: number[] = [];
    for (let i = 0; i < 21; i += 1) retries.push((await retry()).status);

    expect(sends.slice(0, 20).includes(429)).toBe(false);
    expect(sends[20]).toBe(429);
    expect(retries.slice(0, 20).includes(429)).toBe(false);
    expect(retries[20]).toBe(429);
  });

  it('every chat route is throttled', async () => {
    const user = await fixture.chatUser();
    const conversationId = await fixture.conversation(user);
    const server = request(fixture.app.getHttpServer());
    const routes: Array<[string, string]> = [
      ['get', '/api/chat/conversations'],
      ['post', '/api/chat/conversations'],
      ['get', `/api/chat/conversations/${conversationId}`],
      ['delete', `/api/chat/conversations/${SOME_UUID}`],
      ['get', '/api/chat/usage'],
      ['post', `/api/chat/proposals/${SOME_UUID}/apply`],
      ['post', `/api/chat/proposals/${SOME_UUID}/dismiss`],
    ];
    const hit = (method: string, path: string) =>
      (method === 'get' ? server.get(path) : method === 'delete' ? server.delete(path) : server.post(path)).set('Authorization', `Bearer ${user.jwt}`);

    const last: number[] = [];
    for (const [method, path] of routes) {
      let status = 0;
      for (let i = 0; i < 121; i += 1) status = (await hit(method, path)).status;
      last.push(status);
    }

    expect(last).toEqual(routes.map(() => 429));
  });
});
