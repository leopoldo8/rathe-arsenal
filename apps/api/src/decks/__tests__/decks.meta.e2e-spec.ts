import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';

const PASSWORD = 'deck-meta-e2e-password-123';

describe('PATCH /api/decks/:deckId notes, format and status (E2E)', () => {
  let app: INestApplication;
  let jwt: string;
  let deckId: number;
  const suffix = Date.now().toString(36);

  function patch(body: object): request.Test {
    return request(app.getHttpServer())
      .patch(`/api/decks/${deckId}`)
      .set('Authorization', `Bearer ${jwt}`)
      .send(body);
  }

  function detail(): request.Test {
    return request(app.getHttpServer())
      .get(`/api/decks/${deckId}`)
      .set('Authorization', `Bearer ${jwt}`);
  }

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'development';
    process.env['DATABASE_URL'] =
      process.env['DATABASE_URL'] ?? 'postgresql://postgres:dev@localhost:5432/rathe_arsenal';
    process.env['JWT_SECRET'] =
      process.env['JWT_SECRET'] ?? 'test-jwt-secret-that-is-at-least-32-chars-long';
    process.env['JWT_EXPIRES_IN'] = '1d';
    process.env['RESEND_API_KEY'] =
      process.env['RESEND_API_KEY'] ?? 're_test_fake_key_for_dev_bypass';
    process.env['EMAIL_FROM'] = 'Test <noreply@test.local>';
    process.env['APP_BASE_URL'] = 'http://localhost:5173';
    process.env['PORT'] = '0';

    jest.spyOn(ThrottlerGuard.prototype, 'canActivate').mockResolvedValue(true);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.listen(0, '127.0.0.1');

    const server = app.getHttpServer();
    const email = `deck-meta-${suffix}@test.local`;
    const signUp = await request(server)
      .post('/api/auth/sign-up')
      .send({ email, password: PASSWORD })
      .expect(202);
    const token = new URL(signUp.body._devVerificationLink as string).searchParams.get('token');
    await request(server).post('/api/auth/verify-email').send({ token }).expect(200);
    const signIn = await request(server)
      .post('/api/auth/sign-in')
      .send({ email, password: PASSWORD })
      .expect(200);
    jwt = signIn.body.jwt as string;

    const created = await request(server)
      .post('/api/decks')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ heroIdentifier: 'katsu-the-wanderer', format: 'Classic Constructed' })
      .expect(201);
    deckId = created.body.id as number;
  });

  afterAll(async () => {
    await app.close();
  });

  it('reports null notes on a fresh deck', async () => {
    const res = await detail().expect(200);

    expect(res.body.notes).toBeNull();
  });

  it('persists notes and returns them from the PATCH response and a later GET', async () => {
    const patched = await patch({ notes: 'Liga local, sexta.\nTrocar o Flex.' }).expect(200);
    const fetched = await detail().expect(200);

    expect(patched.body.notes).toBe('Liga local, sexta.\nTrocar o Flex.');
    expect(fetched.body.notes).toBe('Liga local, sexta.\nTrocar o Flex.');
  });

  it('keeps notes when an unrelated field is patched', async () => {
    await patch({ name: 'Renamed deck' }).expect(200);
    const fetched = await detail().expect(200);

    expect(fetched.body.name).toBe('Renamed deck');
    expect(fetched.body.notes).toBe('Liga local, sexta.\nTrocar o Flex.');
  });

  it('rejects notes over 2000 characters and leaves the stored notes alone', async () => {
    await patch({ notes: 'x'.repeat(2001) }).expect(400);
    const fetched = await detail().expect(200);

    expect(fetched.body.notes).toBe('Liga local, sexta.\nTrocar o Flex.');
  });

  it('clears notes with null', async () => {
    await patch({ notes: null }).expect(200);
    const fetched = await detail().expect(200);

    expect(fetched.body.notes).toBeNull();
  });

  it('changes the format through PATCH', async () => {
    await patch({ format: 'Blitz' }).expect(200);
    const fetched = await detail().expect(200);

    expect(fetched.body.format).toBe('Blitz');
  });

  it('rejects an unsupported format', async () => {
    await patch({ format: 'Commoner' }).expect(400);
    const fetched = await detail().expect(200);

    expect(fetched.body.format).toBe('Blitz');
  });

  it.each(['idea', 'building', 'ready', 'active', 'retired'])(
    'round-trips status %s',
    async (status) => {
      const patched = await patch({ status }).expect(200);
      const fetched = await detail().expect(200);

      expect(patched.body.status).toBe(status);
      expect(fetched.body.status).toBe(status);
    },
  );
});
