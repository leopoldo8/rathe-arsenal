import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = isHttp ? exception.getResponse() : { message: 'Internal server error' };

    if (!isHttp || status >= 500) {
      this.logger.error({
        event: 'unhandled_exception',
        path: request.url,
        method: request.method,
        error: exception instanceof Error ? exception.message : 'unknown',
      });
      // OBS-04: report unhandled/server-side errors only — 4xx client errors
      // (expected validation/auth failures) are excluded to avoid noise.
      Sentry.captureException(exception);
    }

    const payloadIsString = typeof payload === 'string';
    const errorMessage = payloadIsString
      ? payload
      : (payload as { message?: string }).message ?? payload;
    const code = !payloadIsString ? (payload as { code?: string }).code : undefined;

    response.status(status).json({
      success: false,
      statusCode: status,
      error: errorMessage,
      ...(typeof code === 'string' ? { code } : {}),
      timestamp: new Date().toISOString(),
    });
  }
}
