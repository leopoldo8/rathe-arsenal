import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { resolveLocale, TLocale } from './resolve-locale';

/**
 * Controller parameter decorator that reads the `Accept-Language` header from
 * the incoming request and returns the resolved TLocale ('pt-BR' or 'en-US').
 * Absent or unrecognized headers resolve to 'pt-BR'.
 */
export const AcceptLanguage = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TLocale => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return resolveLocale(request.headers['accept-language']);
  },
);
