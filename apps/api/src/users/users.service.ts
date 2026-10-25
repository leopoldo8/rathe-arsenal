import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TSpareRule, UserEntity } from '../database/entities/user.entity';
import { normalizeWhatsappNumber } from './normalize-whatsapp';

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

  async updateDisplayName(userId: string, displayName: string): Promise<{ displayName: string }> {
    await this.updateProfileColumn(userId, { displayName });
    return { displayName };
  }

  async updateContact(
    userId: string,
    whatsappNumber: string | null,
  ): Promise<{ whatsappNumber: string | null }> {
    const normalized = whatsappNumber === null ? null : normalizeWhatsappNumber(whatsappNumber);
    if (whatsappNumber !== null && normalized === null) {
      throw new BadRequestException('WhatsApp number must have 10 to 15 digits');
    }
    await this.updateProfileColumn(userId, { whatsappNumber: normalized });
    return { whatsappNumber: normalized };
  }

  async updateShareClosingLine(userId: string, text: string): Promise<{ text: string }> {
    const trimmed = text.trim();
    await this.updateProfileColumn(userId, { shareClosingLine: trimmed === '' ? null : trimmed });
    return { text: trimmed };
  }

  async updateSellClosingLine(userId: string, text: string): Promise<{ text: string }> {
    const trimmed = text.trim();
    await this.updateProfileColumn(userId, { sellClosingLine: trimmed === '' ? null : trimmed });
    return { text: trimmed };
  }

  /** `firstAnswer` is true when the player had no rule yet, so the review can tell a first answer from a change. */
  async updateSpareRule(userId: string, rule: TSpareRule): Promise<{ rule: TSpareRule }> {
    const user = await this.users.findOne({ where: { id: userId }, select: { id: true, spareRule: true } });
    if (!user) throw new NotFoundException('User not found');
    await this.updateProfileColumn(userId, { spareRule: rule });
    this.logger.log({ event: 'spare.rule.set', userId, rule, firstAnswer: user.spareRule === null });
    return { rule };
  }

  private async updateProfileColumn(
    userId: string,
    column: Partial<Pick<UserEntity, 'displayName' | 'whatsappNumber' | 'shareClosingLine' | 'sellClosingLine' | 'spareRule'>>,
  ): Promise<void> {
    const result = await this.users.update({ id: userId }, column);
    if (result.affected === 0) {
      throw new NotFoundException('User not found');
    }
  }
}
