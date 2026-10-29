import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export const ORIGIN_REJECTED_CODE = 'ORIGIN_REJECTED';

const WRITE_METHODS: ReadonlySet<string> = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const logger = new Logger('OriginCheck');

/** The one origin writes may come from: the address players are sent to by e-mail (door 17). */
export function allowedOriginOf(appBaseUrl: string): string {
  return new URL(appBaseUrl).origin;
}

/**
 * Door 17: the session cookie is `SameSite=Lax`, which does not stop a request from a sibling
 * subdomain, so a write that names another origin is refused. A write with no `Origin` header (a
 * script or a server, never a browser form) is judged by its session alone. The response has the
 * shape of `HttpExceptionFilter`, which does not run for middleware.
 */
export function originCheck(readAppBaseUrl: () => string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    if (!WRITE_METHODS.has(req.method) || origin === undefined || origin === allowedOriginOf(readAppBaseUrl())) {
      next();
      return;
    }
    logger.warn({ event: 'auth.origin_rejected', origin, method: req.method, path: req.path });
    res.status(403).json({
      success: false,
      statusCode: 403,
      error: 'Request origin not allowed',
      code: ORIGIN_REJECTED_CODE,
      timestamp: new Date().toISOString(),
    });
  };
}
