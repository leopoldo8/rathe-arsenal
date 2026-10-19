import { INestApplication, RequestMethod } from '@nestjs/common';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';
import { createValidationPipe } from '../common/validation/create-validation-pipe';

export const SHARE_PAGE_ROUTES = [
  { path: 'd/:token', method: RequestMethod.GET },
  { path: 'l/:token', method: RequestMethod.GET },
] as const;

/** Shared by `main.ts` and the e2e bootstraps, so tests route requests exactly as production does. */
export function configureHttpApp(app: INestApplication): INestApplication {
  app.setGlobalPrefix('api', { exclude: [...SHARE_PAGE_ROUTES] });
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());
  return app;
}
