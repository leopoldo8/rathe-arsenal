import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Put, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthService } from '../auth/auth.service';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { SetPasswordDto } from '../auth/dtos/set-password.dto';
import { AUTH_THROTTLE } from '../auth/auth-throttle';
import { mapAuthError } from '../auth/auth-error.mapper';
import { AuthError, EAuthErrorCode } from '../auth/errors';
import { readSessionToken } from '../auth/session-cookie';
import { AcceptLanguage } from '../common/i18n/accept-language.decorator';
import { TLocale } from '../common/i18n/resolve-locale';
import { UpdateContactDto } from './dtos/update-contact.dto';
import { UpdateSellClosingLineDto } from './dtos/update-sell-closing-line.dto';
import { UpdateSpareRuleDto } from './dtos/update-spare-rule.dto';
import { UpdateShareClosingLineDto } from './dtos/update-share-closing-line.dto';
import { UpdateDisplayNameDto } from './dtos/update-display-name.dto';
import { PatchThemeDto } from './dtos/user-settings.dto';
import type { TSpareRule } from '../database/entities/user.entity';
import { UsersService, IUserSettings } from './users.service';

// 30 PATCH requests per minute per user — tighter than the global 120/min
// default since theme toggling should not be a high-frequency action.
const MINUTE_MS = 60 * 1000;

/**
 * UsersController — manages `/api/users/me/*` endpoints.
 *
 * Auth: all routes are protected by the global JwtAuthGuard (no @Public()).
 * Rate limit: PATCH overrides the global throttler with a tighter 30/min window.
 */
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  /**
   * GET /api/users/me/settings
   * Returns the current user's theme preference.
   *
   * Rate limit: 60/min per user — tighter than the global 120/min default but
   * more lenient than PATCH, since reads are side-effect-free and a legit client
   * may re-fetch on window focus etc.
   */
  @Get('me/settings')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: MINUTE_MS } })
  async getSettings(@CurrentUser() currentUser: ICurrentUser): Promise<IUserSettings> {
    return this.usersService.getSettings(currentUser.userId);
  }

  /**
   * PATCH /api/users/me/settings
   * Updates the current user's theme preference.
   *
   * The ValidationPipe (whitelist: true) strips unknown keys from the body
   * before this handler is called, enforcing the closed-schema contract.
   */
  @Patch('me/settings')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: MINUTE_MS } })
  async patchSettings(
    @CurrentUser() currentUser: ICurrentUser,
    @Body() dto: PatchThemeDto,
  ): Promise<IUserSettings> {
    return this.usersService.patchSettings(currentUser.userId, dto.theme);
  }

  @Patch('me/display-name')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: MINUTE_MS } })
  async patchDisplayName(
    @CurrentUser() currentUser: ICurrentUser,
    @Body() dto: UpdateDisplayNameDto,
  ): Promise<{ displayName: string }> {
    return this.usersService.updateDisplayName(currentUser.userId, dto.displayName);
  }

  @Patch('me/contact')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: MINUTE_MS } })
  async patchContact(
    @CurrentUser() currentUser: ICurrentUser,
    @Body() dto: UpdateContactDto,
  ): Promise<{ whatsappNumber: string | null }> {
    return this.usersService.updateContact(currentUser.userId, dto.whatsappNumber);
  }

  @Patch('me/share-closing-line')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: MINUTE_MS } })
  async patchShareClosingLine(
    @CurrentUser() currentUser: ICurrentUser,
    @Body() dto: UpdateShareClosingLineDto,
  ): Promise<{ text: string }> {
    return this.usersService.updateShareClosingLine(currentUser.userId, dto.text);
  }

  @Patch('me/sell-closing-line')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: MINUTE_MS } })
  async patchSellClosingLine(
    @CurrentUser() currentUser: ICurrentUser,
    @Body() dto: UpdateSellClosingLineDto,
  ): Promise<{ text: string }> {
    return this.usersService.updateSellClosingLine(currentUser.userId, dto.text);
  }

  @Put('me/spare-rule')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: MINUTE_MS } })
  async putSpareRule(
    @CurrentUser() currentUser: ICurrentUser,
    @Body() dto: UpdateSpareRuleDto,
  ): Promise<{ rule: TSpareRule }> {
    return this.usersService.updateSpareRule(currentUser.userId, dto.rule);
  }

  /** E-mails a six-digit code to the account's own address; the password change needs it back. */
  @Post('me/password-code')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: AUTH_THROTTLE.codes })
  async postPasswordCode(
    @CurrentUser() currentUser: ICurrentUser,
    @AcceptLanguage() locale: TLocale,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ expiresAt: Date; resendAfter: Date }> {
    try {
      return await this.authService.requestPasswordCode(currentUser.userId, locale);
    } catch (err) {
      throw this.asHttpError(err, res);
    }
  }

  /**
   * Sets or replaces the password once the e-mailed code is spent, and signs every other device out;
   * this one stays signed in. A wrong code answers 400, never 401: the web client reads a 401 as a
   * lost session.
   */
  @Put('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: MINUTE_MS } })
  async putPassword(
    @CurrentUser() currentUser: ICurrentUser,
    @Body() dto: SetPasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    try {
      await this.authService.changePasswordWithCode(currentUser.userId, dto.code, dto.password, readSessionToken(req));
    } catch (err) {
      throw this.asHttpError(err, res);
    }
  }

  private asHttpError(err: unknown, res: Response): unknown {
    if (!(err instanceof AuthError)) return err;
    if (err.retryAfterSeconds !== undefined) res.setHeader('Retry-After', String(err.retryAfterSeconds));
    if (err.code === EAuthErrorCode.InvalidCode) {
      return new BadRequestException({ message: err.message, code: err.code });
    }
    return mapAuthError(err);
  }
}
