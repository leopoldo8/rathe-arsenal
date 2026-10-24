import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthError, EAuthErrorCode } from './errors';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const SITEVERIFY_TIMEOUT_MS = 5000;
const WARN_EVERY_MS = 60 * 60 * 1000;

@Injectable()
export class TurnstileService {
  private readonly logger = new Logger(TurnstileService.name);
  private lastMissingSecretWarningAt: number | null = null;

  constructor(private readonly config: ConfigService) {}

  /** Throws `CAPTCHA_FAILED` when a configured secret and Cloudflare say the token is not a person's. */
  async assertHuman(token: string | undefined, ip: string | undefined): Promise<void> {
    const secret = this.config.get<string>('TURNSTILE_SECRET_KEY');
    if (!secret) {
      this.warnMissingSecret();
      return;
    }
    if (!token) throw this.refusal();

    const verdict = await this.askCloudflare(secret, token, ip);
    if (verdict === 'unreachable') return;
    if (!verdict) throw this.refusal();
  }

  private async askCloudflare(secret: string, token: string, ip: string | undefined): Promise<boolean | 'unreachable'> {
    const form = new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) });
    try {
      const response = await fetch(SITEVERIFY_URL, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`siteverify answered ${response.status}`);
      const answer = (await response.json()) as { success?: boolean };
      return answer.success === true;
    } catch (err) {
      this.logger.warn({ event: 'auth.turnstile.unreachable', reason: err instanceof Error ? err.message : 'unknown' });
      return 'unreachable';
    }
  }

  private warnMissingSecret(): void {
    const now = Date.now();
    if (this.lastMissingSecretWarningAt !== null && now - this.lastMissingSecretWarningAt < WARN_EVERY_MS) return;
    this.lastMissingSecretWarningAt = now;
    this.logger.warn({ event: 'auth.turnstile.secret_missing' });
  }

  private refusal(): AuthError {
    return new AuthError(EAuthErrorCode.CaptchaFailed, 'The Turnstile check failed');
  }
}
