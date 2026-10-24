import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createMock } from '@golevelup/ts-jest';
import { createHash } from 'crypto';
import type { Repository } from 'typeorm';
import { EUserRole, UserEntity } from '../../database/entities/user.entity';
import { UserSessionEntity } from '../../database/entities/user-session.entity';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { SessionService } from '../session.service';
import { TokenGeneratorService } from '../services/token-generator.service';

const TOKEN = 'a'.repeat(43);
const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

function makeContext(cookies: Record<string, string> | undefined): { context: ExecutionContext; request: Record<string, unknown> } {
  const request: Record<string, unknown> = { headers: {}, cookies };
  const context = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({ cookie: jest.fn() }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
  return { context, request };
}

function user(overrides: Partial<UserEntity> = {}): UserEntity {
  return { id: 'user-1', email: 'a@b.com', role: EUserRole.User, chatAccess: false, deletedAt: null, emailVerifiedAt: null, ...overrides } as UserEntity;
}

function session(overrides: Partial<UserSessionEntity> = {}): UserSessionEntity {
  return { id: 's-1', lastSeenAt: new Date(), revokedAt: null, user: user(), ...overrides } as UserSessionEntity;
}

function build(row: UserSessionEntity | null): { guard: JwtAuthGuard; findOne: jest.Mock } {
  const findOne = jest.fn().mockResolvedValue(row);
  const repo = { findOne, update: jest.fn() } as unknown as Repository<UserSessionEntity>;
  const config = createMock<ConfigService>();
  const sessions = new SessionService(repo, new TokenGeneratorService(), config);
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) } as unknown as Reflector;
  return { guard: new JwtAuthGuard(reflector, sessions), findOne };
}

describe('JwtAuthGuard', () => {
  it('allows public routes without looking at the cookie', async () => {
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(true) } as unknown as Reflector;
    const sessions = createMock<SessionService>();
    const guard = new JwtAuthGuard(reflector, sessions);

    await expect(guard.canActivate(makeContext(undefined).context)).resolves.toBe(true);
    expect(sessions.authenticate).not.toHaveBeenCalled();
  });

  it('the guard looks the session hash up', async () => {
    const live = build(session());
    const { context, request } = makeContext({ ra_session: TOKEN });
    await expect(live.guard.canActivate(context)).resolves.toBe(true);
    expect(live.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: { tokenHash: sha256(TOKEN) } }));
    expect(request['user']).toEqual({ userId: 'user-1', email: 'a@b.com', role: EUserRole.User, chatAccess: false });

    const unconfirmed = build(session({ user: user({ emailVerifiedAt: null }) }));
    await expect(unconfirmed.guard.canActivate(makeContext({ ra_session: TOKEN }).context)).resolves.toBe(true);

    const refused: Array<[string, JwtAuthGuard, Record<string, string> | undefined]> = [
      ['no cookie', build(session()).guard, undefined],
      ['an empty cookie jar', build(session()).guard, {}],
      ['an unknown token', build(null).guard, { ra_session: TOKEN }],
      ['a revoked row', build(session({ revokedAt: new Date() })).guard, { ra_session: TOKEN }],
      ['a deleted user', build(session({ user: user({ deletedAt: new Date() }) })).guard, { ra_session: TOKEN }],
    ];
    for (const [label, guard, cookies] of refused) {
      await expect(guard.canActivate(makeContext(cookies).context)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(label).toBeTruthy();
    }
  });
});
