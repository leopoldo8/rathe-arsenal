import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { CreateTagDto } from './dto/create-tag.dto';
import { ITagResponse } from './dto/tag-response.dto';
import { TagsService } from './tags.service';

// Throttle constant — matches auth.controller.ts convention.
const MINUTE_MS = 60 * 1000;

/**
 * TagsController — manages /api/tags endpoints.
 *
 * Auth: all routes are protected by the global JwtAuthGuard (no @Public()).
 *
 * Rate limit (R5): POST /tags overrides the global 120/min default with a
 * tighter 30/min window to prevent automated tag-spam.
 */
@Controller('tags')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  /**
   * GET /api/tags
   * Returns all tags owned by the authenticated user, ordered by LOWER(name).
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async list(@CurrentUser() user: ICurrentUser): Promise<ITagResponse[]> {
    return this.tagsService.list(user.userId);
  }

  /**
   * POST /api/tags
   * Creates a new tag for the authenticated user.
   *
   * Rate limited to 30/min (on top of the global 120/min) per R5.
   * Returns 201 Created with the full tag payload.
   * Returns 409 Conflict on case-insensitive name collision.
   * Returns 422 Unprocessable Entity when the 200-tag cap is exceeded.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 30, ttl: MINUTE_MS } })
  async create(
    @CurrentUser() user: ICurrentUser,
    @Body() dto: CreateTagDto,
  ): Promise<ITagResponse> {
    return this.tagsService.create(user.userId, dto.name);
  }

  /**
   * DELETE /api/tags/:id
   * Deletes the tag owned by the authenticated user.
   *
   * Returns 204 No Content on success.
   * Returns 404 if the tag does not exist or belongs to a different user.
   * FK CASCADE removes all tracked_deck_tag join rows automatically.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: ICurrentUser,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.tagsService.remove(user.userId, id);
  }
}
