/**
 * Link preview E2E: GET /d/:token injects share meta tags into the SPA index.html, and
 * GET /api/shared/decks/:token/image serves the generated, stored JPEG.
 *
 * Needs a real PostgreSQL DB (DATABASE_URL). Card faces are stubbed (no network in CI)
 * and the SPA index.html is a fixture injected through SPA_INDEX_HTML.
 */
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ThrottlerGuard } from '@nestjs/throttler';
import { mkdtemp, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { catalog } from '@rathe-arsenal/engine';
import request from 'supertest';
import sharp from 'sharp';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { FetchGuardService } from '../common/fetch-guard/fetch-guard.service';
import { configureHttpApp } from '../http/configure-http-app';
import { DeckShareService } from '../sharing/deck-share.service';
import { DecksService } from '../decks/decks.service';
import { DeckCardEntity } from '../database/entities/deck-card.entity';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { ShareLinkEntity, TDeckShareIntent } from '../database/entities/share-link.entity';
import { UserEntity } from '../database/entities/user.entity';
import { generateShareToken } from '../sharing/share-token';
import { SPA_INDEX_HTML } from '../sharing/preview/spa-index-html';
import { DELETE_SHARE_LINKS_FOR_USERS_SQL } from '../sharing/preview/share-link-cleanup';
import { buildPurgeStatements } from '../sharing/preview/purge-plan';

const SPA_FIXTURE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Rathe Arsenal</title><meta name="description" content="spa default"></head>
<body><div id="root"></div></body></html>`;

const MAX_IMAGE_BYTES = 600 * 1024;
const NASTY_DECK_NAME = 'Blades <script>alert(1)</script> "quoted"';
const DAWNBLADE_FACE_URLS = catalog.getCard('dawnblade').imageUrl!.sources.map((source) => source.large);
const MAINBOARD = ['steelblade-supremacy-red', 'dawnblade', 'hit-and-run-red', 'ironsong-determination-yellow'];

interface IFetchStub {
  readonly guardedFetch: jest.Mock<Promise<{ status: number; headers: Record<string, string>; body: Uint8Array }>, [string]>;
}

describe('Share preview (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let faceBody: Uint8Array;
  let failingUrls: readonly string[] = [];
  const fetchStub: IFetchStub = { guardedFetch: jest.fn() };
  const suffix = Date.now().toString(36);
  const createdUserIds: string[] = [];

  async function createLink(
    deckId: number,
    userId: string,
    intent: TDeckShareIntent,
  ): Promise<{ token: string; linkId: number }> {
    const token = generateShareToken();
    const link = await dataSource.getRepository(ShareLinkEntity).save(
      dataSource.getRepository(ShareLinkEntity).create({
        token,
        targetKind: 'deck',
        targetId: deckId,
        intent,
        ownerUserId: userId,
      }),
    );
    return { token, linkId: link.id };
  }

  async function createSharedDeck(options: {
    name?: string;
    displayName?: string;
    deletedAt?: Date | null;
    intent?: TDeckShareIntent;
  } = {}): Promise<{ token: string; deckId: number; userId: string; linkId: number }> {
    const user = await dataSource.getRepository(UserEntity).save(
      dataSource.getRepository(UserEntity).create({
        email: `share-preview-${suffix}-${createdUserIds.length}@test.local`,
        passwordHash: 'x'.repeat(60),
        emailVerifiedAt: new Date(),
        displayName: options.displayName ?? 'Rodrigo H.',
        deletedAt: options.deletedAt ?? null,
      }),
    );
    createdUserIds.push(user.id);
    const deck = await dataSource.getRepository(TrackedDeckEntity).save(
      dataSource.getRepository(TrackedDeckEntity).create({
        userId: user.id,
        name: options.name ?? NASTY_DECK_NAME,
        hero: 'Dorinthea Ironsong',
        heroIdentifier: 'dorinthea-ironsong',
        format: 'Classic Constructed',
        status: 'building',
      }),
    );
    const cards = [
      { cardIdentifier: 'dorinthea-ironsong', quantity: 1, slot: 'hero' },
      ...MAINBOARD.map((cardIdentifier, index) => ({ cardIdentifier, quantity: 3 - (index % 3), slot: 'mainboard' })),
    ];
    await dataSource.getRepository(DeckCardEntity).save(
      cards.map((card) => dataSource.getRepository(DeckCardEntity).create({ ...card, trackedDeckId: deck.id })),
    );
    const { token, linkId } = await createLink(deck.id, user.id, options.intent ?? 'deck');
    return { token, deckId: deck.id, userId: user.id, linkId };
  }

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'development';
    process.env['DATABASE_URL'] =
      process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
    process.env['JWT_SECRET'] = process.env['JWT_SECRET'] ?? 'test-jwt-secret-that-is-at-least-32-chars-long';
    process.env['RESEND_API_KEY'] = process.env['RESEND_API_KEY'] ?? 're_test_fake_key_for_dev_bypass';
    process.env['EMAIL_FROM'] = 'Test <noreply@test.local>';
    process.env['APP_BASE_URL'] = 'http://localhost:5173';
    process.env['PORT'] = '0';

    faceBody = await sharp({ create: { width: 450, height: 630, channels: 3, background: '#7a5a2a' } })
      .webp()
      .toBuffer();
    fetchStub.guardedFetch.mockImplementation(async (url: string) => {
      if (failingUrls.includes(url)) throw new Error('stubbed network failure');
      return { status: 200, headers: {}, body: faceBody };
    });

    const indexPath = join(await mkdtemp(join(tmpdir(), 'share-preview-e2e-')), 'index.html');
    await writeFile(indexPath, SPA_FIXTURE);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideProvider(FetchGuardService)
      .useValue(fetchStub)
      .overrideProvider(SPA_INDEX_HTML)
      .useValue(indexPath)
      .compile();

    app = configureHttpApp(moduleRef.createNestApplication());
    await app.listen(0, '127.0.0.1');
    dataSource = moduleRef.get<DataSource>(getDataSourceToken());
  });

  beforeEach(() => {
    failingUrls = [];
    fetchStub.guardedFetch.mockClear();
  });

  afterAll(async () => {
    if (dataSource?.isInitialized && createdUserIds.length > 0) {
      await dataSource.query(`DELETE FROM "user" WHERE id = ANY($1::uuid[])`, [createdUserIds]);
      await dataSource.query(`DELETE FROM "card_art_block"`);
    }
    await app?.close();
  });

  describe('GET /d/:token', () => {
    it('answers a live token with the SPA html carrying escaped, absolute share tags', async () => {
      const { token } = await createSharedDeck();

      const res = await request(app.getHttpServer()).get(`/d/${token}`).expect(200);

      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.headers['cache-control']).toBe('no-cache');
      expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
      expect(res.text).toContain('<div id="root">');
      expect(res.text).not.toContain('<script>alert(1)</script>');
      expect(res.text).toContain(
        'og:title" content="Blades &lt;script&gt;alert(1)&lt;/script&gt; &quot;quoted&quot;"',
      );
      expect(res.text).toMatch(new RegExp(`og:image" content="http://localhost:5173/api/shared/decks/${token}/image\\?v=[\\w-]{10}"`));
      expect(res.text).toContain('content="Deck de Rodrigo H. no Rathe Arsenal: Dorinthea Ironsong, Classic Constructed, 10 cartas"');
      expect(res.text).toContain('name="robots" content="noindex,nofollow"');
      expect(res.text.match(/<title>/g)).toHaveLength(1);
      expect(res.text).not.toContain('spa default');
    });

    it('answers a missing-cards link with tags that ask for the missing cards', async () => {
      const { token } = await createSharedDeck({ intent: 'missing', name: 'Blades' });

      const res = await request(app.getHttpServer()).get(`/d/${token}`).expect(200);

      expect(res.text).toContain('og:title" content="Procuro cartas para Blades"');
      expect(res.text).toMatch(/og:description" content="Rodrigo H\. procura \d+ cópias: \d+ /);
      expect(res.text).toMatch(new RegExp(`og:image" content="http://localhost:5173/api/shared/decks/${token}/image\\?v=[\\w-]{10}"`));
      expect(res.text.match(/<title>/g)).toHaveLength(1);
    });

    it('answers a quote link with tags that ask for a quote and name no store', async () => {
      const { token } = await createSharedDeck({ intent: 'quote', name: 'Blades' });

      const res = await request(app.getHttpServer()).get(`/d/${token}`).expect(200);

      expect(res.text).toContain('og:title" content="Orçamento: cartas para Blades"');
      expect(res.text).toMatch(/og:description" content="Rodrigo H\. pede orçamento de \d+ cópias\."/);
      expect(res.text).toContain('name="robots" content="noindex,nofollow"');
      expect(res.text).not.toMatch(/C[uú]pula|cupuladt/i);
    });

    it('answers an unknown token with the generic tags and no deck data', async () => {
      const res = await request(app.getHttpServer()).get(`/d/${generateShareToken()}`).expect(200);

      expect(res.text).toContain('<title>Rathe Arsenal</title>');
      expect(res.text).toContain('og:image" content="http://localhost:5173/api/shared/decks/unavailable/image"');
      expect(res.text).not.toContain('Dorinthea');
      expect(res.headers['x-robots-tag']).toBe('noindex, nofollow');
    });

    it('answers a malformed token with the generic tags', async () => {
      const res = await request(app.getHttpServer()).get('/d/not-a-token').expect(200);

      expect(res.text).toContain('<title>Rathe Arsenal</title>');
    });

    it('treats a token whose owner was soft-deleted as unavailable', async () => {
      const { token } = await createSharedDeck({ deletedAt: new Date() });

      const res = await request(app.getHttpServer()).get(`/d/${token}`).expect(200);

      expect(res.text).toContain('<title>Rathe Arsenal</title>');
      expect(res.text).not.toContain('Dorinthea');
    });

    it('does not serve the page under the api prefix', async () => {
      const { token } = await createSharedDeck();

      await request(app.getHttpServer()).get(`/api/d/${token}`).expect(404);
    });
  });

  describe('GET /api/shared/decks/:token/image', () => {
    it('serves a stored JPEG for a quote link', async () => {
      const { token, linkId } = await createSharedDeck({ intent: 'quote', name: 'Blades' });

      const image = await request(app.getHttpServer())
        .get(`/api/shared/decks/${token}/image`)
        .buffer(true)
        .parse(binaryParser as never)
        .expect(200);

      expect(image.headers['content-type']).toBe('image/jpeg');
      expect(await sharp(image.body).metadata()).toMatchObject({ format: 'jpeg', width: 1200, height: 630 });
      const stored = await dataSource.query(`SELECT 1 FROM share_image WHERE "shareLinkId" = $1`, [linkId]);
      expect(stored).toHaveLength(1);
    });

    it('serves a stored JPEG under 600 KB for a live token and reuses it while nothing changes', async () => {
      const { token, linkId } = await createSharedDeck();

      const first = await request(app.getHttpServer())
        .get(`/api/shared/decks/${token}/image`)
        .buffer(true)
        .parse(binaryParser as never)
        .expect(200);

      expect(first.headers['content-type']).toBe('image/jpeg');
      expect(first.headers['cache-control']).toBe('public, max-age=300');
      expect(first.headers['x-robots-tag']).toBe('noindex, nofollow');
      expect(first.body.length).toBeLessThan(MAX_IMAGE_BYTES);
      expect(await sharp(first.body).metadata()).toMatchObject({ format: 'jpeg', width: 1200, height: 630 });
      expect(fetchStub.guardedFetch).toHaveBeenCalled();

      const stored = await dataSource.query(`SELECT "contentHash", "cardIdentifiers" FROM share_image WHERE "shareLinkId" = $1`, [linkId]);
      expect(stored).toHaveLength(1);
      expect(stored[0].cardIdentifiers).toEqual(expect.arrayContaining(['dorinthea-ironsong', 'steelblade-supremacy-red']));

      fetchStub.guardedFetch.mockClear();
      const second = await request(app.getHttpServer())
        .get(`/api/shared/decks/${token}/image`)
        .buffer(true)
        .parse(binaryParser as never)
        .expect(200);

      expect(second.body.equals(first.body)).toBe(true);
      expect(fetchStub.guardedFetch).not.toHaveBeenCalled();
    });

    it('draws again when the display name changes', async () => {
      const { token, linkId, userId } = await createSharedDeck();
      await request(app.getHttpServer()).get(`/api/shared/decks/${token}/image`).expect(200);
      const [before] = await dataSource.query(`SELECT "contentHash" FROM share_image WHERE "shareLinkId" = $1`, [linkId]);

      await dataSource.getRepository(UserEntity).update({ id: userId }, { displayName: 'Another Name' });
      await request(app.getHttpServer()).get(`/api/shared/decks/${token}/image`).expect(200);
      const [after] = await dataSource.query(`SELECT "contentHash" FROM share_image WHERE "shareLinkId" = $1`, [linkId]);

      expect(after.contentHash).not.toBe(before.contentHash);
    });

    it('serves the generic JPEG for unknown and malformed tokens', async () => {
      for (const token of [generateShareToken(), 'unavailable']) {
        const res = await request(app.getHttpServer())
          .get(`/api/shared/decks/${token}/image`)
          .buffer(true)
          .parse(binaryParser as never)
          .expect(200);

        expect(res.headers['content-type']).toBe('image/jpeg');
        expect(res.body.length).toBeLessThan(MAX_IMAGE_BYTES);
        expect(await sharp(res.body).metadata()).toMatchObject({ width: 1200, height: 630 });
      }
      expect(fetchStub.guardedFetch).not.toHaveBeenCalled();
    });

    it('adds a download filename only when asked', async () => {
      const { token } = await createSharedDeck({ name: 'Lâminas de Ironsong' });

      const plain = await request(app.getHttpServer()).get(`/api/shared/decks/${token}/image`).expect(200);
      const download = await request(app.getHttpServer()).get(`/api/shared/decks/${token}/image?download=1`).expect(200);

      expect(plain.headers['content-disposition']).toBeUndefined();
      expect(download.headers['content-disposition']).toBe('attachment; filename="laminas-de-ironsong.jpg"');
    });

    it('draws a card back for a face that fails to load, and does not store that image', async () => {
      const { token, linkId } = await createSharedDeck();
      failingUrls = DAWNBLADE_FACE_URLS;
      const failing = jest.spyOn(console, 'error').mockImplementation(() => undefined);

      const res = await request(app.getHttpServer())
        .get(`/api/shared/decks/${token}/image`)
        .buffer(true)
        .parse(binaryParser as never)
        .expect(200);
      failing.mockRestore();

      expect(await sharp(res.body).metadata()).toMatchObject({ width: 1200, height: 630 });
      expect(res.headers['cache-control']).toBe('public, max-age=60');
      expect(await dataSource.query(`SELECT 1 FROM share_image WHERE "shareLinkId" = $1`, [linkId])).toHaveLength(0);
    });

    it('never fetches or draws a blocked card, and the purge removes the stored image showing it', async () => {
      const { token, linkId } = await createSharedDeck();
      await request(app.getHttpServer()).get(`/api/shared/decks/${token}/image`).expect(200);
      expect(await dataSource.query(`SELECT 1 FROM share_image WHERE "shareLinkId" = $1`, [linkId])).toHaveLength(1);

      for (const statement of buildPurgeStatements({ mode: 'cards', cardIdentifiers: ['dawnblade'] })) {
        await dataSource.query(statement.sql, [...statement.params]);
      }
      expect(await dataSource.query(`SELECT 1 FROM share_image WHERE "shareLinkId" = $1`, [linkId])).toHaveLength(0);

      fetchStub.guardedFetch.mockClear();
      await request(app.getHttpServer()).get(`/api/shared/decks/${token}/image`).expect(200);

      const fetchedUrls = fetchStub.guardedFetch.mock.calls.map(([url]) => url);
      expect(fetchedUrls.length).toBeGreaterThan(0);
      expect(fetchedUrls.length).toBe(4);
      expect(fetchedUrls.some((url) => DAWNBLADE_FACE_URLS.includes(url))).toBe(false);
      const [row] = await dataSource.query(`SELECT "cardIdentifiers" FROM share_image WHERE "shareLinkId" = $1`, [linkId]);
      expect(row.cardIdentifiers).not.toContain('dawnblade');
      await dataSource.query(`DELETE FROM card_art_block`);
    });

    it('removes the stored image when the owner is hard-deleted by the purge scripts', async () => {
      const { token, linkId, userId } = await createSharedDeck();
      await request(app.getHttpServer()).get(`/api/shared/decks/${token}/image`).expect(200);

      await dataSource.query(DELETE_SHARE_LINKS_FOR_USERS_SQL, [[userId]]);

      expect(await dataSource.query(`SELECT 1 FROM share_image WHERE "shareLinkId" = $1`, [linkId])).toHaveLength(0);
    });

    it('removes the stored image when sharing is turned off', async () => {
      const { token, deckId, userId, linkId } = await createSharedDeck();
      await request(app.getHttpServer()).get(`/api/shared/decks/${token}/image`).expect(200);

      await app.get(DeckShareService).disable(userId, deckId, 'deck');

      expect(await dataSource.query(`SELECT 1 FROM share_image WHERE "shareLinkId" = $1`, [linkId])).toHaveLength(0);
    });

    it('removes the stored image and the link when the deck is deleted', async () => {
      const { token, deckId, userId, linkId } = await createSharedDeck();
      await request(app.getHttpServer()).get(`/api/shared/decks/${token}/image`).expect(200);

      await app.get(DecksService).permanentDelete(userId, deckId);

      expect(await dataSource.query(`SELECT 1 FROM share_image WHERE "shareLinkId" = $1`, [linkId])).toHaveLength(0);
      expect(await dataSource.query(`SELECT 1 FROM share_link WHERE id = $1`, [linkId])).toHaveLength(0);
    });

    it('draws and stores a separate image for each intent of one deck', async () => {
      const { token: deckToken, deckId, userId, linkId: deckLinkId } = await createSharedDeck();
      const { token: missingToken, linkId: missingLinkId } = await createLink(deckId, userId, 'missing');

      const deckImage = await request(app.getHttpServer())
        .get(`/api/shared/decks/${deckToken}/image`)
        .buffer(true)
        .parse(binaryParser as never)
        .expect(200);
      const missingImage = await request(app.getHttpServer())
        .get(`/api/shared/decks/${missingToken}/image`)
        .buffer(true)
        .parse(binaryParser as never)
        .expect(200);

      expect(deckToken).not.toBe(missingToken);
      expect(missingImage.body.equals(deckImage.body)).toBe(false);
      expect(await sharp(missingImage.body).metadata()).toMatchObject({ format: 'jpeg', width: 1200, height: 630 });
      const stored = await dataSource.query(
        `SELECT "shareLinkId", "contentHash" FROM share_image WHERE "shareLinkId" = ANY($1::int[])`,
        [[deckLinkId, missingLinkId]],
      );
      expect(stored).toHaveLength(2);
      expect(new Set(stored.map((row: { contentHash: string }) => row.contentHash)).size).toBe(2);
      if (process.env['SHARE_RENDER_DIR']) {
        await writeFile(join(process.env['SHARE_RENDER_DIR'], 'missing-intent.jpg'), missingImage.body);
        await writeFile(join(process.env['SHARE_RENDER_DIR'], 'deck-intent.jpg'), deckImage.body);
      }
    });

    it('removes only the image of the link that is turned off', async () => {
      const { token: deckToken, deckId, userId, linkId: deckLinkId } = await createSharedDeck();
      const { token: missingToken, linkId: missingLinkId } = await createLink(deckId, userId, 'missing');
      await request(app.getHttpServer()).get(`/api/shared/decks/${deckToken}/image`).expect(200);
      await request(app.getHttpServer()).get(`/api/shared/decks/${missingToken}/image`).expect(200);

      await app.get(DeckShareService).disable(userId, deckId, 'missing');

      expect(await dataSource.query(`SELECT 1 FROM share_image WHERE "shareLinkId" = $1`, [missingLinkId])).toHaveLength(0);
      expect(await dataSource.query(`SELECT 1 FROM share_image WHERE "shareLinkId" = $1`, [deckLinkId])).toHaveLength(1);
    });
  });
});

type TBinaryParser = (
  res: NodeJS.ReadableStream & { on(event: string, listener: (chunk: Buffer) => void): unknown },
  callback: (error: Error | null, body: Buffer) => void,
) => void;

const binaryParser: TBinaryParser = (res, callback) => {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
};
