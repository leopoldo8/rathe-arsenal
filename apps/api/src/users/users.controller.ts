import { Body, Controller, Get, HttpCode, HttpStatus, Patch } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
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
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /api/users/me/settings
   * Returns the current user's theme preference.
   */
  @Get('me/settings')
  @HttpCode(HttpStatus.OK)
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
}
