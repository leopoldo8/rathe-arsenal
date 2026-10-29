import { ConfigService } from '@nestjs/config';
import { createMock } from '@golevelup/ts-jest';
import { EntityManager, Repository } from 'typeorm';
import { SignInCodeEntity } from '../../database/entities/sign-in-code.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { EmailService } from '../../email/email.service';
import { AuthError } from '../errors';
import { SIGN_IN_CODE_MAX_UNTRIED_PER_ADDRESS_PER_HOUR, SignInCodeService } from '../sign-in-code.service';
import { TokenGeneratorService } from '../services/token-generator.service';

const ONE_HOUR_IN_SECONDS = 3600;

function buildService(): SignInCodeService {
  return new SignInCodeService(
    createMock<Repository<SignInCodeEntity>>(),
    createMock<Repository<UserEntity>>(),
    new TokenGeneratorService(),
    createMock<EmailService>(),
    createMock<ConfigService>(),
  );
}

describe('SignInCodeService per-address Retry-After', () => {
  const now = Date.parse('2026-10-27T12:00:00.000Z');

  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(now);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('never exceeds one hour when the database clock stamped the oldest code ahead of this process', async () => {
    // Arrange
    const clockSkewMs = 1500;
    const rows = Array.from({ length: SIGN_IN_CODE_MAX_UNTRIED_PER_ADDRESS_PER_HOUR }, (_, index) =>
      Object.assign(new SignInCodeEntity(), { createdAt: new Date(now + clockSkewMs + index), attempts: 0 }),
    );
    const manager = createMock<EntityManager>();
    manager.query.mockResolvedValue([]);
    manager.find.mockResolvedValue(rows);
    const service = buildService();

    // Act
    const error = await (service as unknown as {
      assertUnderAddressLimit(m: EntityManager, email: string, purpose: 'sign_in'): Promise<void>;
    })
      .assertUnderAddressLimit(manager, 'a@b.test', 'sign_in')
      .catch((err: unknown) => err);

    // Assert
    expect(error).toBeInstanceOf(AuthError);
    const retryAfterSeconds = (error as AuthError).retryAfterSeconds;
    expect(retryAfterSeconds).toBeLessThanOrEqual(ONE_HOUR_IN_SECONDS);
    expect(retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });
});
