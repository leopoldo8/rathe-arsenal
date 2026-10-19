import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ICurrentUser } from '../dtos/current-user.dto';

/**
 * For `@Public()` routes that want the visitor when there is one: a valid
 * Bearer token puts the user on the request, anything else leaves it anonymous.
 * Never rejects.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      await super.canActivate(context);
    } catch {
      this.clearUser(context);
    }
    return true;
  }

  override handleRequest<TUser = ICurrentUser>(_err: unknown, user: TUser | false): TUser {
    return (user || undefined) as TUser;
  }

  private clearUser(context: ExecutionContext): void {
    const request = context.switchToHttp().getRequest<{ user?: unknown }>();
    request.user = undefined;
  }
}
