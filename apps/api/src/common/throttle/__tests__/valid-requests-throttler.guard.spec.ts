import { Body, Controller, HttpCode, INestApplication, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Throttle, ThrottlerModule } from '@nestjs/throttler';
import { IsString, MinLength } from 'class-validator';
import request from 'supertest';
import { configureHttpApp } from '../../../http/configure-http-app';
import { ThrottleValidRequestsOnly, ValidRequestsThrottlerGuard } from '../valid-requests-throttler.guard';

class SecretDto {
  @IsString()
  @MinLength(10)
  secret!: string;
}

const LIMIT = 3;

@Controller('probe')
class ProbeController {
  @Throttle({ default: { limit: LIMIT, ttl: 60_000 } })
  @ThrottleValidRequestsOnly()
  @Post('forgiving')
  @HttpCode(200)
  forgiving(@Body() _dto: SecretDto): { ok: true } {
    return { ok: true };
  }

  @Throttle({ default: { limit: LIMIT, ttl: 60_000 } })
  @Post('strict')
  @HttpCode(200)
  strict(@Body() _dto: SecretDto): { ok: true } {
    return { ok: true };
  }
}

describe('ValidRequestsThrottlerGuard', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 1000 }])],
      controllers: [ProbeController],
      providers: [{ provide: APP_GUARD, useClass: ValidRequestsThrottlerGuard }],
    }).compile();
    app = configureHttpApp(moduleRef.createNestApplication());
    // Listening on the loopback address keeps supertest off a wildcard port that another local
    // process may already hold on 127.0.0.1, which answers requests meant for this app.
    await app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await app?.close();
  });

  const post = (path: string, body: unknown): request.Test => request(app.getHttpServer()).post(path).send(body as object);

  it('does not count a body the global validation pipe rejects', async () => {
    const bodies = [{ secret: 'short' }, {}, { secret: 'longenoughsecret', extra: 1 }];
    for (let round = 0; round < LIMIT + 2; round++) {
      for (const body of bodies) {
        expect((await post('/api/probe/forgiving', body)).status).toBe(400);
      }
    }

    expect((await post('/api/probe/forgiving', { secret: 'longenoughsecret' })).status).toBe(200);
  });

  it('counts valid requests on a marked route', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < LIMIT + 1; i++) {
      statuses.push((await post('/api/probe/forgiving', { secret: 'longenoughsecret' })).status);
    }

    expect(statuses.slice(-1)).toEqual([429]);
  });

  it('counts every request on a route that is not marked, valid or not', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < LIMIT + 1; i++) {
      statuses.push((await post('/api/probe/strict', { secret: 'short' })).status);
    }

    expect(statuses).toEqual([400, 400, 400, 429]);
  });

  it('counts a body that makes the pipe itself fail, since only a clean 400 is forgiven', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < LIMIT + 1; i++) {
      statuses.push((await post('/api/probe/forgiving', { secret: { toString: 1 } })).status);
    }

    expect(statuses.slice(-1)).toEqual([429]);
  });
});
