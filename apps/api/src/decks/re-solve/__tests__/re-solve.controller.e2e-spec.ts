import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
} from '@nestjs/common';
import request from 'supertest';
import { ReSolveController } from '../re-solve.controller';

/**
 * Tests for the deprecated re-solve endpoints.
 * All three endpoints should return 410 Gone with a structured deprecation payload.
 * This verifies tab-safety — open frontend tabs receive a clear 410 instead of
 * a 500 or 404 during the single-commit atomic deploy.
 */
describe('ReSolveController — 410 Gone deprecation stubs (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ReSolveController],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const EXPECTED_PAYLOAD = {
    code: 'DEPRECATED',
    migration: 'use /api/decks/:trackedDeckId/decisions',
  };

  describe('POST /decks/:deckId/reject-substitute', () => {
    it('returns 410 Gone with structured deprecation payload', async () => {
      await request(app.getHttpServer())
        .post('/decks/1/reject-substitute')
        .send({ cardIdentifier: 'some-card' })
        .expect(410)
        .expect((res) => {
          expect(res.body).toMatchObject(EXPECTED_PAYLOAD);
          expect(res.body.code).toBe('DEPRECATED');
          expect(res.body.migration).toContain('/decisions');
        });
    });
  });

  describe('POST /decks/:deckId/reset-rejections', () => {
    it('returns 410 Gone with structured deprecation payload', async () => {
      await request(app.getHttpServer())
        .post('/decks/1/reset-rejections')
        .expect(410)
        .expect((res) => {
          expect(res.body).toMatchObject(EXPECTED_PAYLOAD);
        });
    });
  });

  describe('POST /decks/:deckId/re-solve', () => {
    it('returns 410 Gone with structured deprecation payload', async () => {
      await request(app.getHttpServer())
        .post('/decks/1/re-solve')
        .send({ excludedCardIdentifiers: [] })
        .expect(410)
        .expect((res) => {
          expect(res.body).toMatchObject(EXPECTED_PAYLOAD);
        });
    });
  });
});
