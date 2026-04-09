import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

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
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      error: typeof payload === 'string' ? payload : (payload as { message?: string }).message ?? payload,
      timestamp: new Date().toISOString(),
    });
  }
}
