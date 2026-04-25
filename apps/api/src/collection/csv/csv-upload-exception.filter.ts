import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Response } from 'express';

/**
 * Converts multer's `LIMIT_FILE_SIZE` error — which NestJS surfaces as a
 * 413 `PayloadTooLargeException` — into a uniform 400 `BadRequestException`
 * with the `FILE_TOO_LARGE` error code expected by the client.
 *
 * Scoped to `CsvController` via `@UseFilters` so it does not affect other
 * routes.
 */
@Catch(PayloadTooLargeException)
export class CsvUploadExceptionFilter implements ExceptionFilter {
  catch(exception: PayloadTooLargeException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const err = new BadRequestException('FILE_TOO_LARGE');
    const status = err.getStatus();
    const body = err.getResponse();

    response.status(status).json(body);
  }
}
