import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EEmailErrorCode, EmailDeliveryError } from './errors';
import { renderVerificationEmail } from './templates/verification-email.template';
import { renderPasswordResetEmail } from './templates/password-reset-email.template';

const APP_NAME = 'Rathe Arsenal';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly isDev: boolean;

  constructor(private readonly config: ConfigService) {
    this.isDev = config.get<string>('NODE_ENV') !== 'production';
    this.from = config.get<string>('EMAIL_FROM') ?? `${APP_NAME} <onboarding@resend.dev>`;
    if (!this.isDev) {
      this.resend = new Resend(config.get<string>('RESEND_API_KEY'));
    } else {
      this.resend = null;
    }
  }

  async sendVerificationEmail(to: string, link: string): Promise<void> {
    const rendered = renderVerificationEmail({ link, appName: APP_NAME });
    await this.send(to, rendered.subject, rendered.html, rendered.text, link);
  }

  async sendPasswordResetEmail(to: string, link: string): Promise<void> {
    const rendered = renderPasswordResetEmail({ link, appName: APP_NAME });
    await this.send(to, rendered.subject, rendered.html, rendered.text, link);
  }

  private async send(to: string, subject: string, html: string, text: string, link: string): Promise<void> {
    if (this.isDev) {
      this.logger.log({
        event: 'email.dev_bypass',
        to,
        subject,
        link,
        message: 'Email not sent in development mode — use the link above',
      });
      return;
    }
    if (!this.resend) {
      throw new EmailDeliveryError(EEmailErrorCode.Network, 'Resend client not initialized');
    }
    try {
      const result = await this.resend.emails.send({ from: this.from, to, subject, html, text });
      if (result.error) {
        this.logger.error({ event: 'email.send_failed', code: result.error.name });
        throw this.mapResendError(result.error);
      }
      this.logger.log({ event: 'email.sent', id: result.data?.id });
    } catch (err) {
      if (err instanceof EmailDeliveryError) throw err;
      this.logger.error({ event: 'email.send_failed', error: (err as Error).message });
      throw new EmailDeliveryError(EEmailErrorCode.Network, (err as Error).message);
    }
  }

  private mapResendError(error: { name: string; message: string }): EmailDeliveryError {
    if (error.name === 'rate_limit_exceeded' || error.message.includes('rate limit')) {
      return new EmailDeliveryError(EEmailErrorCode.RateLimited, error.message);
    }
    if (error.name === 'validation_error' || error.message.includes('invalid')) {
      return new EmailDeliveryError(EEmailErrorCode.InvalidRecipient, error.message);
    }
    return new EmailDeliveryError(EEmailErrorCode.Network, error.message);
  }
}
