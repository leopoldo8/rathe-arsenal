import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DecisionsController } from '../decisions.controller';

const SWAP_ROUTES = [
  '/api/swaps',
  '/api/swaps/:id/approve',
  '/api/swaps/:id/reject',
  '/api/swaps/:id/revert',
  '/api/swaps/:id/restore',
  '/api/swaps/:id/outcome',
];

describe('DecisionsController — 410 Gone stubs', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DecisionsController],
    }).compile();
    app = moduleRef.createNestApplication();
    // Listening on the loopback address keeps supertest off a wildcard port that another local
    // process may already hold on 127.0.0.1, which answers requests meant for this app.
    await app.listen(0, '127.0.0.1');
  });

  afterEach(async () => {
    await app.close();
  });

  it.each([
    ['GET /decks/:id/decisions', () => request(app.getHttpServer()).get('/decks/1/decisions')],
    [
      'POST /decks/:id/decisions',
      () =>
        request(app.getHttpServer())
          .post('/decks/1/decisions')
          .send({ cardIdentifier: 'x', decision: 'approved' }),
    ],
    [
      'DELETE /decks/:id/decisions/:cardIdentifier',
      () => request(app.getHttpServer()).delete('/decks/1/decisions/some-card'),
    ],
    [
      'DELETE /decks/:id/decisions?scope=rejections',
      () => request(app.getHttpServer()).delete('/decks/1/decisions?scope=rejections'),
    ],
  ])('%s returns 410 with a payload naming every swaps route', async (_label, call) => {
    const res = await call();

    expect(res.status).toBe(410);
    expect(res.body.code).toBe('DEPRECATED');
    for (const route of SWAP_ROUTES) {
      expect(res.body.migration).toContain(route);
    }
  });
});
