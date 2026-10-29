import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request, Response } from 'express';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { ICurrentUser } from './dtos/current-user.dto';
import { SessionService } from './session.service';

/**
 * Global APP_GUARD. Lets a request through when its `ra_session` cookie names a live session and
 * puts the account on `request.user`; honors `@Public()` on routes that opt out. The name predates
 * door 17: no JWT is involved any more.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: ICurrentUser }>();
    const user = await this.sessions.authenticate(request, http.getResponse<Response>());
    if (!user) throw new UnauthorizedException();
    request.user = user;
    return true;
  }
}
