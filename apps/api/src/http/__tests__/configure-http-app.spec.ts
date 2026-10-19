import { Controller, Get, INestApplication, Param } from '@nestjs/common';
import { Test } from '@nestjs/testing';
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
}

describe('configureHttpApp', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ProbeController] }).compile();
    app = configureHttpApp(moduleRef.createNestApplication());
    await app.init();
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
});
