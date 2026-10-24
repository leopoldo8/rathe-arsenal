import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { ICurrentUser } from './dtos/current-user.dto';
import { SignUpDto } from './dtos/sign-up.dto';
import { SignInDto } from './dtos/sign-in.dto';
import { VerifyEmailDto } from './dtos/verify-email.dto';
import { StartDto } from './dtos/start.dto';
import { RequestCodeDto } from './dtos/request-code.dto';
import { VerifyCodeDto } from './dtos/verify-code.dto';
import { RedeemCodeDto } from './dtos/redeem-code.dto';
import { ResendVerificationDto } from './dtos/resend-verification.dto';
import { DeleteAccountDto } from './dtos/delete-account.dto';
import { AuthService } from './auth.service';
import { AUTH_THROTTLE } from './auth-throttle';
import { setSessionCookie } from './session-cookie';
import { AuthError } from './errors';
import { mapAuthError } from './auth-error.mapper';
import { AcceptLanguage } from '../common/i18n/accept-language.decorator';
import { TLocale } from '../common/i18n/resolve-locale';

@Controller('auth')
export class AuthController {
  private readonly isProduction: boolean;

  constructor(
    private readonly authService: AuthService,
    config: ConfigService,
  ) {
    this.isProduction = config.get<string>('NODE_ENV') === 'production';
  }

  @Public()
  @Throttle({ default: AUTH_THROTTLE.start })
  @Post('start')
  @HttpCode(HttpStatus.OK)
  async start(@Body() dto: StartDto) {
    return this.authService.start(dto.email);
  }

  @Public()
  @Throttle({ default: AUTH_THROTTLE.signUp })
  @Post('sign-up')
  @HttpCode(HttpStatus.CREATED)
  async signUp(
    @Body() dto: SignUpDto,
    @AcceptLanguage() locale: TLocale,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      return this.withSession(res, await this.authService.signUp(dto, locale));
    } catch (err) {
      if (err instanceof AuthError) throw mapAuthError(err);
      throw err;
    }
  }

  @Public()
  @Throttle({ default: AUTH_THROTTLE.signIn })
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  async signIn(@Body() dto: SignInDto, @Res({ passthrough: true }) res: Response) {
    try {
      return this.withSession(res, await this.authService.signIn(dto.email, dto.password));
    } catch (err) {
      if (err instanceof AuthError) throw mapAuthError(err);
      throw err;
    }
  }

  @Public()
  @Throttle({ default: AUTH_THROTTLE.codes })
  @Post('codes')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestCode(@Body() dto: RequestCodeDto, @AcceptLanguage() locale: TLocale) {
    try {
      return await this.authService.requestCode(dto.email, locale);
    } catch (err) {
      if (err instanceof AuthError) throw mapAuthError(err);
      throw err;
    }
  }

  @Public()
  @Throttle({ default: AUTH_THROTTLE.codesVerify })
  @Post('codes/verify')
  @HttpCode(HttpStatus.OK)
  async verifyCode(@Body() dto: VerifyCodeDto, @Res({ passthrough: true }) res: Response) {
    try {
      return this.withSession(res, await this.authService.verifyCode(dto.email, dto.code));
    } catch (err) {
      if (err instanceof AuthError) throw mapAuthError(err);
      throw err;
    }
  }

  @Public()
  @Throttle({ default: AUTH_THROTTLE.codesRedeem })
  @Post('codes/redeem')
  @HttpCode(HttpStatus.OK)
  async redeemCode(@Body() dto: RedeemCodeDto, @Res({ passthrough: true }) res: Response) {
    try {
      return this.withSession(res, await this.authService.redeemCode(dto.token));
    } catch (err) {
      if (err instanceof AuthError) throw mapAuthError(err);
      throw err;
    }
  }

  @Public()
  @Throttle({ default: AUTH_THROTTLE.verifyEmail })
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

  // A6: resend-verification endpoint. Always returns a generic 202 regardless
  // of whether the email exists or is already verified.
  @Public()
  @Throttle({ default: AUTH_THROTTLE.resendVerification })
  @Post('resend-verification')
  @HttpCode(HttpStatus.ACCEPTED)
  async resendVerification(@Body() dto: ResendVerificationDto, @AcceptLanguage() locale: TLocale) {
    try {
      return await this.authService.resendVerification(dto.email, locale);
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
  // 5/hour per IP — strict
  // enough that a compromised JWT cannot drain an account before the user
  // notices, but lenient enough that a user mistyping their password a few
  // times can recover within the same session.
  @Throttle({ default: AUTH_THROTTLE.deleteAccount })
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

  /** Sets the session cookie for a response that signs the caller in, and passes the body on. */
  private withSession<T extends { jwt: string }>(res: Response, body: T): T {
    setSessionCookie(res, body.jwt, this.isProduction);
    return body;
  }
}
