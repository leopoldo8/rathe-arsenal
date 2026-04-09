import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createMock } from '@golevelup/ts-jest';
import { Repository } from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity';
import { JwtStrategy } from '../strategies/jwt.strategy';

describe('JwtStrategy.validate', () => {
  function build(repoFindOne: jest.Mock) {
    const config = createMock<ConfigService>();
    config.get.mockImplementation((key: string) => (key === 'JWT_SECRET' ? 'a'.repeat(32) : undefined));
    const repo = { findOne: repoFindOne } as unknown as Repository<UserEntity>;
    return new JwtStrategy(config, repo);
  }

  it('returns { userId, email } for a verified user (happy path)', async () => {
    const repoFindOne = jest.fn().mockResolvedValue({
      id: 'user-1',
      email: 'a@b.com',
      emailVerifiedAt: new Date(),
    } as Partial<UserEntity>);
    const strategy = build(repoFindOne);

    await expect(strategy.validate({ sub: 'user-1' })).resolves.toEqual({
      userId: 'user-1',
      email: 'a@b.com',
    });
    expect(repoFindOne).toHaveBeenCalledWith({ where: { id: 'user-1' } });
  });

  it('throws Unauthorized when no user matches the sub', async () => {
    const strategy = build(jest.fn().mockResolvedValue(null));
    await expect(strategy.validate({ sub: 'missing' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws Unauthorized when the user exists but is not email-verified', async () => {
    const strategy = build(
      jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        emailVerifiedAt: null,
      } as Partial<UserEntity>),
    );
    const err = await strategy
      .validate({ sub: 'user-1' })
      .catch((e) => e as UnauthorizedException);
    expect(err).toBeInstanceOf(UnauthorizedException);
    // No internal-detail leakage in the message
    expect((err as Error).message.toLowerCase()).not.toContain('verified');
  });

  it('throws at construction when JWT_SECRET is not configured', () => {
    const config = createMock<ConfigService>();
    config.get.mockReturnValue(undefined);
    const repo = createMock<Repository<UserEntity>>();
    expect(() => new JwtStrategy(config, repo)).toThrow(/JWT_SECRET/);
  });
});
