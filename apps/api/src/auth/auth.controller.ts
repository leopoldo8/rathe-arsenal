import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { ICurrentUser } from './dtos/current-user.dto';
import { SignUpDto } from './dtos/sign-up.dto';
import { SignInDto } from './dtos/sign-in.dto';
import { VerifyEmailDto } from './dtos/verify-email.dto';
import { ForgotPasswordDto } from './dtos/forgot-password.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import { ResendVerificationDto } from './dtos/resend-verification.dto';
import { DeleteAccountDto } from './dtos/delete-account.dto';
import { AuthService } from './auth.service';
import { AuthError } from './errors';
import { mapAuthError } from './auth-error.mapper';

// A5: per-IP rate-limit windows for auth endpoints. ttl values are in
// milliseconds as required by @nestjs/throttler v6.
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: HOUR_MS } })
  @Post('sign-up')
  @HttpCode(HttpStatus.ACCEPTED)
  async signUp(@Body() dto: SignUpDto) {
    try {
      return await this.authService.signUp(dto.email, dto.password);
    } catch (err) {
      if (err instanceof AuthError) throw mapAuthError(err);
      throw err;
    }
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: MINUTE_MS } })
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  async signIn(@Body() dto: SignInDto) {
    try {
      return await this.authService.signIn(dto.email, dto.password);
    } catch (err) {
      if (err instanceof AuthError) throw mapAuthError(err);
      throw err;
    }
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: HOUR_MS } })
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    try {
      return await this.authService.verifyEmail(dto.token);
    } catch (err) {
      if (err instanceof AuthError) throw mapAuthError(err);
      throw err;
    }
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: HOUR_MS } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.requestPasswordReset(dto.email);
    return { ok: true };
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: HOUR_MS } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    try {
      return await this.authService.resetPassword(dto.token, dto.newPassword);
    } catch (err) {
      if (err instanceof AuthError) throw mapAuthError(err);
      throw err;
    }
  }

  // A6: resend-verification endpoint. Always returns a generic 202 regardless
  // of whether the email exists or is already verified, mirroring the
  // enumeration-safe pattern in forgot-password.
  @Public()
  @Throttle({ default: { limit: 3, ttl: HOUR_MS } })
  @Post('resend-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  async resendVerification(@Body() dto: ResendVerificationDto) {
    try {
      return await this.authService.resendVerification(dto.email);
    } catch (err) {
      if (err instanceof AuthError) throw mapAuthError(err);
      throw err;
    }
  }

  @Get('me')
  async getMe(@CurrentUser() user: ICurrentUser) {
    return this.authService.getMe(user);
  }

  // A8 / Phase 1a Unit 2: authenticated soft-delete. Requires re-entered
  // password as the destructive-action confirmation gate. Rate-limited to
  // 5/hour per IP — matches forgot-password / reset-password and is strict
  // enough that a compromised JWT cannot drain an account before the user
  // notices, but lenient enough that a user mistyping their password a few
  // times can recover within the same session.
  @Throttle({ default: { limit: 5, ttl: HOUR_MS } })
  @Delete('me')
  @HttpCode(HttpStatus.OK)
  async deleteAccount(
    @CurrentUser() user: ICurrentUser,
    @Body() dto: DeleteAccountDto,
  ) {
    try {
      return await this.authService.deleteAccount(user.userId, dto.password);
    } catch (err) {
      if (err instanceof AuthError) throw mapAuthError(err);
      throw err;
    }
  }
}
