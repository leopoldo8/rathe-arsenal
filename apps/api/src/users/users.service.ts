import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../database/entities/user.entity';

export interface IUserSettings {
  theme: 'dark' | 'light';
}

/**
 * UsersService — manages user-scoped settings (theme preference) persisted to
 * the `preferences` JSONB column on the `user` table (migration 1776621087000).
 *
 * Defensive contracts:
 * - `preferences` may be NULL on rows that somehow bypassed the column default.
 *   All methods use `?? 'dark'` as the fallback to avoid 500s on malformed rows.
 * - `patchSettings` writes only the closed-schema `{ theme }` key, ensuring no
 *   unknown keys can accumulate in the JSONB blob (the DTO/ValidationPipe strips
 *   them before this service is called).
 */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
  ) {}

  async getSettings(userId: string): Promise<IUserSettings> {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      // Should not happen — JWT guard has already validated the user exists.
      // Throwing NotFoundException rather than leaking internals.
      throw new NotFoundException('User not found');
    }
    return { theme: user.preferences?.theme ?? 'dark' };
  }

  async patchSettings(userId: string, theme: 'dark' | 'light'): Promise<IUserSettings> {
    // Atomic targeted UPDATE — only the `preferences` column is touched, so a
    // concurrent write to a different column (e.g. soft-delete setting
    // `deletedAt`) cannot be silently overwritten by a read-modify-write race.
    // The closed-schema literal `{ theme }` keeps unknown keys out of JSONB.
    const result = await this.users.update({ id: userId }, { preferences: { theme } });
    if (result.affected === 0) {
      throw new NotFoundException('User not found');
    }

    this.logger.log({ event: 'users.settings.patched', userId, theme });
    return { theme };
  }
}
