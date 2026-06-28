import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AdminGuard } from '../admin.guard';
import { EUserRole } from '../../../database/entities/user.entity';

function contextWith(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('AdminGuard', () => {
  const guard = new AdminGuard();

  it('allows a user with the admin role', () => {
    expect(guard.canActivate(contextWith({ role: EUserRole.Admin }))).toBe(true);
  });

  it('denies a regular user', () => {
    expect(() => guard.canActivate(contextWith({ role: EUserRole.User }))).toThrow(ForbiddenException);
  });

  it('denies when there is no authenticated user', () => {
    expect(() => guard.canActivate(contextWith(undefined))).toThrow(ForbiddenException);
  });
});
