import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import { Request } from 'express';
import { ICurrentUser } from '../dtos/current-user.dto';

/** Pairs with `OptionalJwtAuthGuard`: the visitor, or null when anonymous. */
export const OptionalCurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ICurrentUser | null => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: ICurrentUser }>();
    return request.user ?? null;
  },
);
