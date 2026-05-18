import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { OwnsTrackedDeckGuard } from '../auth/guards/owns-tracked-deck.guard';
import { DecksService } from './decks.service';
import { ITrackedDeckListResponse } from './dtos/tracked-deck-list.response.dto';
import { ITrackedDeckDetailResponse } from './dtos/tracked-deck-detail.response.dto';
import { CreateScratchDeckDto } from './dto/create-scratch-deck.dto';
import { UpdateDeckMetaDto } from './dto/update-deck-meta.dto';

@Controller('decks')
export class DecksController {
  constructor(private readonly decksService: DecksService) {}

  /**
   * Creates an empty scratch deck owned by the authenticated user.
   *
   * Returns 201 with the standard deck detail payload. The `legality`
   * field will be `'incomplete'` for a 0-card deck.
   *
   * Multiple scratch decks with the same hero+format are allowed — the
   * partial unique index on `fabraryUlid` only enforces uniqueness when
   * `fabraryUlid IS NOT NULL`.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createScratch(
    @Body() dto: CreateScratchDeckDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<ITrackedDeckDetailResponse> {
    return this.decksService.createScratch(user.userId, dto);
  }

  @Get()
  async list(
    @CurrentUser() user: ICurrentUser,
  ): Promise<ITrackedDeckListResponse> {
    return this.decksService.listForUser(user.userId);
  }

  @Get(':deckId')
  @UseGuards(OwnsTrackedDeckGuard)
  async getDetail(
    @Param('deckId', ParseIntPipe) deckId: number,
    @CurrentUser() user: ICurrentUser,
  ): Promise<ITrackedDeckDetailResponse> {
    return this.decksService.getDetail(user.userId, deckId);
  }

  /**
   * PATCH /api/decks/:deckId
   *
   * Partially updates deck metadata. All body fields are optional and
   * independent — sending only `status` leaves name and tags unchanged.
   *
   * Protected by `OwnsTrackedDeckGuard`: 404 when the deck is missing or
   * belongs to another user (never leaks existence to wrong user).
   *
   * Returns the full deck detail payload after the transaction commits.
   */
  @Patch(':deckId')
  @UseGuards(OwnsTrackedDeckGuard)
  @HttpCode(HttpStatus.OK)
  async updateMeta(
    @Param('deckId', ParseIntPipe) deckId: number,
    @Body() dto: UpdateDeckMetaDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<ITrackedDeckDetailResponse> {
    return this.decksService.updateMeta(deckId, user.userId, dto);
  }

  @Delete(':deckId')
  @UseGuards(OwnsTrackedDeckGuard)
  async untrack(
    @Param('deckId', ParseIntPipe) deckId: number,
    @CurrentUser() user: ICurrentUser,
  ): Promise<void> {
    await this.decksService.untrack(user.userId, deckId);
  }
}
