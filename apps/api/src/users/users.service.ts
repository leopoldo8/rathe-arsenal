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
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Construct the exact closed-schema object — no other keys can enter here.
    // Even if the caller passed extra keys, the DTO/ValidationPipe would have
    // stripped them before this method is reached.
    const saved = await this.users.save({
      ...user,
      preferences: { theme },
    });

    this.logger.log({ event: 'users.settings.patched', userId, theme });
    return { theme: saved.preferences?.theme ?? theme };
  }
}
