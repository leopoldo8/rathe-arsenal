import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ICurrentUser } from '../dtos/current-user.dto';
import { SessionService } from '../session.service';

/**
 * For `@Public()` routes that want the visitor when there is one: a live session puts the user on
 * the request, anything else leaves it anonymous. Never rejects.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: ICurrentUser }>();
    const user = await this.sessions.authenticate(request, http.getResponse<Response>()).catch(() => null);
    if (user) request.user = user;
    else delete request.user;
    return true;
  }
}
