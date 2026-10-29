import request from 'supertest';
import { bootFixture, IFixture } from '../../replacements/__tests__/replacements-e2e.fixture';
import { TGeminiFetch } from '../../recommendations/gemini-client';
import { setChatAccess } from '../chat-grant';
import { ChatRunnerService, drainChatOnce } from '../chat-runner.service';
import { ChatTurnQueueService } from '../chat-turn-queue.service';
import { sessionCookieHeader } from '../../auth/__tests__/session-test-helpers';

export { KATSU, EMISSARY, FLEX, COAX, TALISHAR, mainboard } from '../../replacements/__tests__/replacements-e2e.fixture';

export interface IChatUser {
  readonly sessionToken: string;
  readonly email: string;
  readonly userId: string;
  readonly deckId: number;
}

export interface IScriptedFetch {
  readonly fetch: TGeminiFetch;
  readonly requests: Array<{ readonly contents: Array<{ role: string; parts: Array<Record<string, unknown>> }>; readonly tools: Array<{ functionDeclarations: Array<{ name: string; parametersJsonSchema: { type: string } }> }>; readonly systemInstruction: { parts: Array<{ text: string }> } }>;
}

export interface IChatFixture extends IFixture {
  chatUser(options?: { readonly access?: boolean }): Promise<IChatUser>;
  grant(email: string, granted?: boolean): Promise<void>;
  del(path: string, sessionToken: string): request.Test;
  conversation(user: IChatUser, body?: Record<string, unknown>): Promise<string>;
  send(user: IChatUser, conversationId: string, text: string, locale?: string): Promise<{ userMessageId: string; assistantMessageId: string }>;
  seedUsage(userId: string, costUsd: number, createdAt?: Date): Promise<void>;
  drain(fetch: TGeminiFetch, apiKey?: string | null, openRouterModel?: string): Promise<boolean>;
  /** The retry waits of the last drain, recorded instead of slept. */
  readonly slept: readonly number[];
  message(id: string): Promise<Record<string, unknown>>;
}

export const USAGE = { promptTokenCount: 40_000, candidatesTokenCount: 1_000, thoughtsTokenCount: 3_000 };

export function textAnswer(text: string, usage: Record<string, number> = USAGE): unknown {
  return { candidates: [{ finishReason: 'STOP', content: { role: 'model', parts: [{ text }] } }], usageMetadata: usage };
}

export function callAnswer(calls: Array<{ id?: string; name: string; args: Record<string, unknown> }>, usage: Record<string, number> = USAGE): unknown {
  return {
    candidates: [
      {
        finishReason: 'STOP',
        content: { role: 'model', parts: calls.map((call, index) => ({ functionCall: call, ...(index === 0 ? { thoughtSignature: 'sig-opaque==' } : {}) })) },
      },
    ],
    usageMetadata: usage,
  };
}

/** Answers each request with the next scripted body; a number is an HTTP status with no body. */
export function scriptedFetch(script: ReadonlyArray<unknown | number>): IScriptedFetch {
  const requests: IScriptedFetch['requests'] = [];
  let next = 0;
  const fetch: TGeminiFetch = async (_url, init) => {
    requests.push(JSON.parse(init.body));
    const step = script[Math.min(next, script.length - 1)];
    next += 1;
    if (typeof step === 'number') return { ok: false, status: step, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => step };
  };
  return { fetch, requests };
}

export async function bootChatFixture(options: { readonly throttle?: boolean } = {}): Promise<IChatFixture> {
  const base = await bootFixture(options);
  const server = base.app.getHttpServer();
  const queue = base.app.get(ChatTurnQueueService);
  const runner = base.app.get(ChatRunnerService);
  let slept: number[] = [];
  const fixture: IChatFixture = {
    ...base,
    async chatUser(chatOptions = {}) {
      const scenario = await base.scenario();
      if (chatOptions.access !== false) await setChatAccess(base.dataSource, scenario.email, true);
      const [{ id }] = (await base.dataSource.query(`SELECT id FROM "user" WHERE email = $1`, [scenario.email])) as [{ id: string }];
      return { ...scenario, userId: id };
    },
    async grant(email, granted = true) {
      await setChatAccess(base.dataSource, email, granted);
    },
    del: (path, sessionToken) => request(server).delete(path).set('Cookie', sessionCookieHeader(sessionToken)),
    async conversation(user, body = {}) {
      const created = await base.post('/api/chat/conversations', user.sessionToken).send(body).expect(201);
      return created.body.id as string;
    },
    async send(user, conversationId, text, locale = 'en-US') {
      const sent = await base
        .post(`/api/chat/conversations/${conversationId}/messages`, user.sessionToken)
        .set('Accept-Language', locale)
        .send({ text })
        .expect(202);
      return sent.body;
    },
    async seedUsage(userId, costUsd, createdAt = new Date()) {
      await base.dataSource.query(
        `INSERT INTO chat_usage ("userId", model, "inputTokens", "outputTokens", "costUsd", "createdAt") VALUES ($1, 'gemini-3.8-flash', 0, 0, $2, $3)`,
        [userId, costUsd, createdAt],
      );
    },
    drain: (fetch, apiKey = 'test-key', openRouterModel) => {
      slept = [];
      return drainChatOnce({ queue, runner, readApiKey: () => apiKey, readOpenRouterModel: () => openRouterModel, fetch, sleep: async (ms) => void slept.push(ms) });
    },
    get slept() {
      return slept;
    },
    async message(id) {
      const [row] = (await base.dataSource.query(`SELECT * FROM chat_message WHERE id = $1`, [id])) as Array<Record<string, unknown>>;
      return row!;
    },
  };
  return fixture;
}
