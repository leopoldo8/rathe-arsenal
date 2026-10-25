import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Put, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthService } from '../auth/auth.service';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { SetPasswordDto } from '../auth/dtos/set-password.dto';
import { readSessionToken } from '../auth/session-cookie';
import { UpdateContactDto } from './dtos/update-contact.dto';
import { UpdateShareClosingLineDto } from './dtos/update-share-closing-line.dto';
import { UpdateDisplayNameDto } from './dtos/update-display-name.dto';
import { PatchThemeDto } from './dtos/user-settings.dto';
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

  /** Sets or replaces the password and signs every other device out; this one stays signed in. */
  @Put('me/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 30, ttl: MINUTE_MS } })
  async putPassword(
    @CurrentUser() currentUser: ICurrentUser,
    @Body() dto: SetPasswordDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.authService.setPassword(currentUser.userId, dto.password, readSessionToken(req));
  }
}
