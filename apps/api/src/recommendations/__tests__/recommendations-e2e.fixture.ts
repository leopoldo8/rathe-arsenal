import request from 'supertest';
import { bootFixture, IFixture, IScenario } from '../../replacements/__tests__/replacements-e2e.fixture';
import { TGeminiFetch } from '../gemini-client';
import { computeDeckFingerprint } from '../recommendation-prompt';
import { RecommendationQueueService } from '../recommendation-queue.service';
import { drainRecommendationsOnce, RecommendationRunnerService } from '../recommendation-runner.service';

export { KATSU, EMISSARY, FLEX, COAX, TALISHAR } from '../../replacements/__tests__/replacements-e2e.fixture';

export interface IRunRow {
  readonly id: string;
  readonly trackedDeckId: number;
  readonly trigger: string;
  readonly status: string;
  readonly runAfter: Date;
  readonly attempts: number;
  readonly error: string | null;
  readonly deckFingerprint: string | null;
  readonly model: string | null;
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly claimedAt: Date | null;
  readonly createdAt: Date;
}

export interface ISeedEntry {
  readonly card: string;
  readonly strength?: 'clear_upgrade' | 'consider';
  readonly cut?: string;
  readonly cutSlot?: string;
}

export interface IGeminiEntryInput {
  readonly card: string;
  readonly strength?: string;
  readonly cut?: string;
  readonly reason?: string;
}

export interface IRecommendationsFixture extends IFixture {
  runs(deckId: number): Promise<IRunRow[]>;
  clearRuns(deckId: number): Promise<void>;
  makeDue(deckId: number): Promise<void>;
  secondsUntilRunAfter(runId: string): Promise<number>;
  seedDoneRun(deckId: number, entries: readonly ISeedEntry[], options?: { readonly stale?: boolean; readonly finishedAt?: string }): Promise<{ runId: string; ids: string[] }>;
  seedRun(deckId: number, status: string, options?: { readonly trigger?: string; readonly error?: string; readonly finishedAt?: string; readonly claimedMinutesAgo?: number }): Promise<string>;
  drain(fetch: TGeminiFetch, apiKey?: string | null): Promise<boolean>;
  patch(path: string, jwt: string): request.Test;
  del(path: string, jwt: string): request.Test;
  importDecks(jwt: string, count: number): Promise<number[]>;
}

const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function newUlid(): string {
  const tail = Array.from({ length: 22 }, () => ULID_ALPHABET[Math.floor(Math.random() * ULID_ALPHABET.length)]);
  return `01HQ${tail.join('')}`;
}

/** A canned `generateContent` response body. */
export function geminiBody(entries: readonly IGeminiEntryInput[], finishReason = 'STOP'): unknown {
  const recommendations = entries.map((entry) => ({
    card: entry.card,
    strength: entry.strength ?? 'consider',
    cut: entry.cut ?? '',
    reason: entry.reason ?? `Fits the deck: ${entry.card}`,
  }));
  return {
    candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify({ recommendations }) }] } }],
    usageMetadata: { promptTokenCount: 41000, candidatesTokenCount: 900, thoughtsTokenCount: 2100 },
  };
}

export interface IStubFetch {
  readonly fetch: TGeminiFetch;
  readonly calls: Array<{ readonly url: string; readonly body: { contents: Array<{ parts: Array<{ text: string }> }> } }>;
}

export function stubFetch(status: number, body: unknown = {}): IStubFetch {
  const calls: IStubFetch['calls'] = [];
  return {
    calls,
    fetch: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return { ok: status >= 200 && status < 300, status, json: async () => body };
    },
  };
}

export function promptOf(stub: IStubFetch, call = 0): string {
  return stub.calls[call]!.body.contents[0]!.parts[0]!.text;
}

export async function bootRecommendationsFixture(options: { readonly throttle?: boolean } = {}): Promise<IRecommendationsFixture> {
  const base = await bootFixture(options);
  const { dataSource, app } = base;
  const server = app.getHttpServer();
  const queue = app.get(RecommendationQueueService);
  const runner = app.get(RecommendationRunnerService);

  const currentFingerprint = async (deckId: number): Promise<string> => {
    const [deck] = await dataSource.query(`SELECT "heroIdentifier", format FROM tracked_deck WHERE id = $1`, [deckId]);
    const cards = await dataSource.query(`SELECT "cardIdentifier", slot, quantity FROM deck_card WHERE "trackedDeckId" = $1`, [deckId]);
    return computeDeckFingerprint({ heroIdentifier: deck.heroIdentifier, format: deck.format, cards });
  };

  const seedRun: IRecommendationsFixture['seedRun'] = async (deckId, status, options = {}) => {
    const [{ id }] = await dataSource.query(
      `INSERT INTO recommendation_run ("trackedDeckId", "trigger", "status", "runAfter", "error", "finishedAt", "claimedAt", "attempts")
       VALUES ($1, $2, $3::varchar, now(), $4, $5::timestamptz, CASE WHEN $6::int IS NULL THEN NULL ELSE now() - ($6::int * interval '1 minute') END,
               CASE WHEN $3::varchar IN ('running', 'done', 'failed') THEN 1 ELSE 0 END)
       RETURNING id`,
      [deckId, options.trigger ?? 'manual', status, options.error ?? null, options.finishedAt ?? null, options.claimedMinutesAgo ?? null],
    );
    return id as string;
  };

  return {
    ...base,
    runs: (deckId) =>
      dataSource.query(`SELECT * FROM recommendation_run WHERE "trackedDeckId" = $1 ORDER BY "createdAt", id`, [deckId]),
    clearRuns: async (deckId) => {
      await dataSource.query(`DELETE FROM recommendation_run WHERE "trackedDeckId" = $1`, [deckId]);
    },
    makeDue: async (deckId) => {
      await dataSource.query(
        `UPDATE recommendation_run SET "runAfter" = clock_timestamp() - interval '1 second' WHERE "trackedDeckId" = $1 AND status = 'pending'`,
        [deckId],
      );
    },
    secondsUntilRunAfter: async (runId) => {
      const [row] = await dataSource.query(
        `SELECT EXTRACT(EPOCH FROM ("runAfter" - clock_timestamp()))::float AS seconds FROM recommendation_run WHERE id = $1`,
        [runId],
      );
      return row.seconds as number;
    },
    seedDoneRun: async (deckId, entries, options = {}) => {
      const fingerprint = options.stale ? 'f'.repeat(64) : await currentFingerprint(deckId);
      const [{ id: runId }] = await dataSource.query(
        `INSERT INTO recommendation_run ("trackedDeckId", "trigger", "status", "runAfter", "deckFingerprint", "model", "attempts", "finishedAt")
         VALUES ($1, 'manual', 'done', now(), $2, 'gemini-3.8-flash', 1, COALESCE($3::timestamptz, clock_timestamp())) RETURNING id`,
        [deckId, fingerprint, options.finishedAt ?? null],
      );
      const ids: string[] = [];
      for (const [index, entry] of entries.entries()) {
        const [{ id }] = await dataSource.query(
          `INSERT INTO recommendation ("runId", "cardIdentifier", rank, strength, "cutCardIdentifier", "cutSlot", reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [runId, entry.card, index + 1, entry.strength ?? 'consider', entry.cut ?? null, entry.cut ? (entry.cutSlot ?? 'mainboard') : null, `Reason ${entry.card}`],
        );
        ids.push(id);
      }
      return { runId, ids };
    },
    seedRun,
    drain: (fetch, apiKey = 'test-key') =>
      drainRecommendationsOnce({ queue, runner, readApiKey: () => apiKey, fetch }),
    patch: (path, jwt) => request(server).patch(path).set('Authorization', `Bearer ${jwt}`),
    del: (path, jwt) => request(server).delete(path).set('Authorization', `Bearer ${jwt}`),
    importDecks: async (jwt, count) => {
      const response = await request(server)
        .post('/api/decks/import')
        .set('Authorization', `Bearer ${jwt}`)
        .send({ urls: Array.from({ length: count }, () => `https://fabrary.net/decks/${newUlid()}`), seedInventory: false })
        .expect(201);
      return response.body.imported.map((deck: { trackedDeckId: number }) => deck.trackedDeckId);
    },
  };
}

export type { IScenario };
