import { INestApplication, RequestMethod } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { createValidationPipe } from '../common/validation/create-validation-pipe';
import { originCheck } from './origin-check.middleware';

export const SHARE_PAGE_ROUTES = [
  { path: 'd/:token', method: RequestMethod.GET },
  { path: 'l/:token', method: RequestMethod.GET },
] as const;

const DEFAULT_APP_BASE_URL = 'http://localhost:5173';

/**
 * Shared by `main.ts` and the e2e bootstraps, so tests route requests exactly as production does.
 * It also reads the `ra_session` cookie and checks the origin of writes (door 17).
 */
export function configureHttpApp(app: INestApplication): INestApplication {
  app.use(cookieParser());
  // Read per request: the value is in `process.env` once `ConfigModule` has loaded `.env`.
  app.use(originCheck(() => process.env['APP_BASE_URL'] ?? DEFAULT_APP_BASE_URL));
  app.setGlobalPrefix('api', { exclude: [...SHARE_PAGE_ROUTES] });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());
  return app;
}
