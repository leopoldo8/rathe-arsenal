import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createMock } from '@golevelup/ts-jest';
import type { Repository } from 'typeorm';
import { EUserRole, UserEntity } from '../../../database/entities/user.entity';
import { UserSessionEntity } from '../../../database/entities/user-session.entity';
import { SessionService } from '../../session.service';
import { TokenGeneratorService } from '../../services/token-generator.service';
import { OptionalJwtAuthGuard } from '../optional-jwt-auth.guard';

const TOKEN = 'b'.repeat(43);

function contextWith(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({ cookie: jest.fn() }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function user(overrides: Partial<UserEntity> = {}): UserEntity {
  return { id: 'visitor-1', email: 'v@b.com', role: EUserRole.User, chatAccess: false, deletedAt: null, ...overrides } as UserEntity;
}

function guardFor(findOne: jest.Mock): OptionalJwtAuthGuard {
  const repo = { findOne, update: jest.fn() } as unknown as Repository<UserSessionEntity>;
  return new OptionalJwtAuthGuard(new SessionService(repo, new TokenGeneratorService(), createMock<ConfigService>()));
}

const live = (overrides: Partial<UserSessionEntity> = {}): UserSessionEntity =>
  ({ id: 's-1', lastSeenAt: new Date(), revokedAt: null, user: user(), ...overrides }) as UserSessionEntity;

describe('OptionalJwtAuthGuard', () => {
  it('lets a visitor with a live session through with the user on the request', async () => {
    const request: Record<string, unknown> = { cookies: { ra_session: TOKEN } };

    await expect(guardFor(jest.fn().mockResolvedValue(live())).canActivate(contextWith(request))).resolves.toBe(true);

    expect(request['user']).toMatchObject({ userId: 'visitor-1', email: 'v@b.com' });
  });

  it('an unusable session leaves the visitor anonymous', async () => {
    const unusable: Array<[string, Record<string, unknown>, jest.Mock]> = [
      ['no cookie', { cookies: {} }, jest.fn().mockResolvedValue(live())],
      ['an unknown token', { cookies: { ra_session: TOKEN } }, jest.fn().mockResolvedValue(null)],
      ['a revoked row', { cookies: { ra_session: TOKEN } }, jest.fn().mockResolvedValue(live({ revokedAt: new Date() }))],
      ['a deleted user', { cookies: { ra_session: TOKEN } }, jest.fn().mockResolvedValue(live({ user: user({ deletedAt: new Date() }) }))],
      ['a failing lookup', { cookies: { ra_session: TOKEN } }, jest.fn().mockRejectedValue(new Error('database down'))],
    ];

    for (const [label, cookies, findOne] of unusable) {
      const request: Record<string, unknown> = { ...cookies, user: { userId: 'stale' } };
      await expect(guardFor(findOne).canActivate(contextWith(request))).resolves.toBe(true);
      expect({ label, user: request['user'] }).toEqual({ label, user: undefined });
    }
  });
});
