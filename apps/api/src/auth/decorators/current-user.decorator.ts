import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';
import { ICurrentUser } from '../dtos/current-user.dto';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ICurrentUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: ICurrentUser }>();
    if (!request.user) {
      throw new Error('@CurrentUser() used on a route not protected by JwtAuthGuard');
    }
    return request.user;
  },
);
