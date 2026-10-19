import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../optional-jwt-auth.guard';

function contextWith(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({}) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function passportCanActivate(guard: OptionalJwtAuthGuard): jest.SpyInstance {
  return jest.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(guard)), 'canActivate');
}

describe('OptionalJwtAuthGuard', () => {
  afterEach(() => jest.restoreAllMocks());

  it('lets a visitor with a valid token through with the user on the request', async () => {
    const guard = new OptionalJwtAuthGuard();
    const request: Record<string, unknown> = {};
    passportCanActivate(guard).mockImplementation(async () => {
      request.user = { userId: 'visitor-1' };
      return true;
    });

    await expect(guard.canActivate(contextWith(request))).resolves.toBe(true);
    expect(request.user).toEqual({ userId: 'visitor-1' });
  });

  it('lets a visitor whose token is invalid or belongs to a deleted user through anonymously', async () => {
    const guard = new OptionalJwtAuthGuard();
    const request: Record<string, unknown> = { user: { userId: 'stale' } };
    passportCanActivate(guard).mockRejectedValue(new UnauthorizedException());

    await expect(guard.canActivate(contextWith(request))).resolves.toBe(true);
    expect(request.user).toBeUndefined();
  });

  it('turns a missing token into an anonymous request instead of an error', () => {
    const guard = new OptionalJwtAuthGuard();

    expect(guard.handleRequest(null, false)).toBeUndefined();
    expect(guard.handleRequest(new UnauthorizedException(), false)).toBeUndefined();
    expect(guard.handleRequest(null, { userId: 'visitor-1' })).toEqual({ userId: 'visitor-1' });
  });
});
