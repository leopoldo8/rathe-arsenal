import { Controller, Get, INestApplication, Param, Post, Req } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import request from 'supertest';
import { configureHttpApp } from '../configure-http-app';

@Controller()
class ProbeController {
  @Get('d/:token')
  sharePage(@Param('token') token: string): string {
    return `share ${token}`;
  }

  @Get('probe')
  apiRoute(): string {
    return 'api';
  }

  @Get('cookie')
  cookie(@Req() req: Request): string {
    return String((req.cookies as Record<string, string> | undefined)?.['ra_session']);
  }

  @Post('write')
  write(): string {
    return 'written';
  }
}

describe('configureHttpApp', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
    app = configureHttpApp(moduleRef.createNestApplication());
    // Listening on the loopback address keeps supertest off a wildcard port that another local
    // process may already hold on 127.0.0.1, which answers requests meant for this app.
    await app.listen(0, '127.0.0.1');
  });

  afterAll(async () => {
    await app?.close();
  });

  it('serves share pages outside the api prefix', async () => {
    await request(app.getHttpServer()).get('/d/abc').expect(200, 'share abc');
    await request(app.getHttpServer()).get('/api/d/abc').expect(404);
  });

  it('keeps every other route under /api', async () => {
    await request(app.getHttpServer()).get('/api/probe').expect(200, 'api');
    await request(app.getHttpServer()).get('/probe').expect(404);
  });

  it('the shared setup parses the session cookie and checks the origin', async () => {
    const own = process.env['APP_BASE_URL'] ?? 'http://localhost:5173';

    await request(app.getHttpServer()).get('/api/cookie').set('Cookie', 'ra_session=abc123; other=1').expect(200, 'abc123');
    const refused = await request(app.getHttpServer()).post('/api/write').set('Origin', 'https://evil.example').expect(403);
    await request(app.getHttpServer()).post('/api/write').set('Origin', own).expect(201);
    await request(app.getHttpServer()).post('/api/write').expect(201);

    expect(refused.body.code).toBe('ORIGIN_REJECTED');
  });
});
