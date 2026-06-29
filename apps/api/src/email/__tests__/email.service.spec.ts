import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email.service';
import { EEmailErrorCode } from '../errors';

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  const defaults: Record<string, string> = {
    NODE_ENV: 'development',
    RESEND_API_KEY: 're_test',
    EMAIL_FROM: 'test@example.com',
  };
  const merged = { ...defaults, ...overrides };
  return { get: jest.fn((key: string) => merged[key]) } as unknown as ConfigService;
}

describe('EmailService', () => {
  describe('dev mode', () => {
    let service: EmailService;
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
      service = new EmailService(makeConfig());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- spying on private NestJS Logger instance; no public getter exposed
      logSpy = jest.spyOn((service as any).logger, 'log').mockImplementation();
    });

    it('logs the email + link instead of sending (happy path)', async () => {
      await service.sendVerificationEmail('a@b.com', 'https://example.com/verify?token=abc');
      expect(logSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'email.dev_bypass',
          to: 'a@b.com',
          link: 'https://example.com/verify?token=abc',
        }),
      );
    });

    it('does not call Resend in dev mode', async () => {
      // The resend client is null in dev
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- accessing private `resend` field to verify null state; no public getter exposed
      expect((service as any).resend).toBeNull();
      await service.sendPasswordResetEmail('a@b.com', 'https://example.com/reset');
      // No throw = success
    });
  });

  describe('prod mode (mocked Resend)', () => {
    let service: EmailService;
    let sendMock: jest.Mock;

    beforeEach(() => {
      service = new EmailService(makeConfig({ NODE_ENV: 'production' }));
      sendMock = jest.fn();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- injecting mock Resend client into private field; Resend is constructed internally with no DI seam
      (service as any).resend = { emails: { send: sendMock } };
    });

    it('calls resend.emails.send with rendered EN-US template when locale is en-US', async () => {
      sendMock.mockResolvedValue({ data: { id: 'msg_1' }, error: null });
      await service.sendVerificationEmail('a@b.com', 'https://example.com/verify', 'en-US');
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'a@b.com',
          from: 'test@example.com',
          subject: expect.stringContaining('Verify'),
          html: expect.stringContaining('https://example.com/verify'),
          text: expect.stringContaining('https://example.com/verify'),
        }),
      );
    });

    it('calls resend.emails.send with PT-BR template when locale is pt-BR (default)', async () => {
      sendMock.mockResolvedValue({ data: { id: 'msg_2' }, error: null });
      await service.sendVerificationEmail('a@b.com', 'https://example.com/verify');
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: expect.stringContaining('Verifique'),
        }),
      );
    });

    it('throws RATE_LIMITED on rate limit error', async () => {
      sendMock.mockResolvedValue({
        data: null,
        error: { name: 'rate_limit_exceeded', message: 'slow down' },
      });
      await expect(service.sendVerificationEmail('a@b.com', 'https://x.com')).rejects.toMatchObject({
        code: EEmailErrorCode.RateLimited,
      });
    });

    it('throws INVALID_RECIPIENT on validation error', async () => {
      sendMock.mockResolvedValue({
        data: null,
        error: { name: 'validation_error', message: 'invalid email' },
      });
      await expect(service.sendVerificationEmail('bad', 'https://x.com')).rejects.toMatchObject({
        code: EEmailErrorCode.InvalidRecipient,
      });
    });

    it('throws NETWORK on generic throw', async () => {
      sendMock.mockRejectedValue(new Error('connection refused'));
      await expect(service.sendVerificationEmail('a@b.com', 'https://x.com')).rejects.toMatchObject({
        code: EEmailErrorCode.Network,
      });
    });
  });
});
