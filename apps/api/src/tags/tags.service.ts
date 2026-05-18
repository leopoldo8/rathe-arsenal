import {
  ConflictException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeckTagEntity } from '../database/entities/deck-tag.entity';
import { AuthzService } from '../auth/authz.service';
import { ITagResponse } from './dto/tag-response.dto';

/** Maximum number of tags a single user may own (R5). */
const MAX_TAGS_PER_USER = 200;

/**
 * TagsService — business logic for user-owned deck tags (R3a, R5).
 *
 * All mutations are scoped to the authenticated user; ownership enforcement
 * is delegated to AuthzService.assertOwnsTag for DELETE.
 */
@Injectable()
export class TagsService {
  private readonly logger = new Logger(TagsService.name);

  constructor(
    @InjectRepository(DeckTagEntity)
    private readonly tags: Repository<DeckTagEntity>,
    private readonly authzService: AuthzService,
  ) {}

  /**
   * Returns all tags owned by the given user, ordered case-insensitively by name.
   */
  async list(userId: string): Promise<ITagResponse[]> {
    const rows = await this.tags
      .createQueryBuilder('t')
      .select(['t.id', 't.name', 't.createdAt'])
      .where('t.userId = :userId', { userId })
      .orderBy('LOWER(t.name)', 'ASC')
      .getMany();

    return rows.map((r) => ({ id: r.id, name: r.name, createdAt: r.createdAt }));
  }

  /**
   * Creates a new tag for the user.
   *
   * Enforces:
   * - 200-tag-per-user hard cap (422 on overflow)
   * - Case-insensitive name uniqueness per user (409 on duplicate)
   */
  async create(userId: string, name: string): Promise<ITagResponse> {
    // Check 200-tag cap BEFORE insert.
    const existingCount = await this.tags.count({ where: { userId } });
    if (existingCount >= MAX_TAGS_PER_USER) {
      throw new UnprocessableEntityException(
        `You have reached the maximum of ${MAX_TAGS_PER_USER} tags. Please delete unused tags before creating new ones.`,
      );
    }

    // Check case-insensitive uniqueness per user before attempting insert.
    // This is an application-level check; the DB-level unique index on
    // (userId, LOWER(name)) from migration T+3000 acts as the final guard.
    const existingWithSameName = await this.tags
      .createQueryBuilder('t')
      .where('t.userId = :userId', { userId })
      .andWhere('LOWER(t.name) = LOWER(:name)', { name })
      .getOne();

    if (existingWithSameName) {
      throw new ConflictException(
        `A tag named "${existingWithSameName.name}" already exists (names are compared case-insensitively).`,
      );
    }

    const entity = this.tags.create({ userId, name });
    const saved = await this.tags.save(entity);

    this.logger.log('TAG_CREATED', { tagId: saved.id, userId });

    return { id: saved.id, name: saved.name, createdAt: saved.createdAt };
  }

  /**
   * Deletes the tag identified by `tagId` if it belongs to `userId`.
   *
   * Delegates ownership check to AuthzService (404 on missing or wrong user).
   * The FK CASCADE on `tracked_deck_tag` removes all join rows automatically.
   */
  async remove(userId: string, tagId: number): Promise<void> {
    await this.authzService.assertOwnsTag(userId, tagId);

    await this.tags.delete({ id: tagId, userId });

    this.logger.log('TAG_DELETED', { tagId, userId });
  }
}
