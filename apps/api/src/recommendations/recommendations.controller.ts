import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { OwnsTrackedDeckGuard } from '../auth/guards/owns-tracked-deck.guard';
import { AcceptLanguage } from '../common/i18n/accept-language.decorator';
import { TLocale } from '../common/i18n/resolve-locale';
import { IReplacementResponse, ReplacementsService } from '../replacements/replacements.service';
import { AdoptRecommendationDto } from './dtos/adopt-recommendation.dto';
import { DismissRecommendationDto } from './dtos/dismiss-recommendation.dto';
import {
  IDismissalResponse,
  IRecommendationRunSummary,
  IRecommendationsResponse,
  RecommendationsService,
} from './recommendations.service';

const MAX_CARD_IDENTIFIER_LENGTH = 128;
export const GENERATE_LIMIT_PER_MINUTE = 10;

@Controller('decks/:deckId/recommendations')
@UseGuards(OwnsTrackedDeckGuard)
export class RecommendationsController {
  constructor(
    private readonly recommendationsService: RecommendationsService,
    private readonly replacementsService: ReplacementsService,
  ) {}

  @Get()
  read(
    @Param('deckId', ParseIntPipe) deckId: number,
    @CurrentUser() user: ICurrentUser,
    @AcceptLanguage() locale: TLocale,
  ): Promise<IRecommendationsResponse> {
    return this.recommendationsService.read(user.userId, deckId, locale);
  }

  @Post('runs')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: GENERATE_LIMIT_PER_MINUTE, ttl: 60_000 } })
  async generate(@Param('deckId', ParseIntPipe) deckId: number): Promise<{ run: IRecommendationRunSummary }> {
    return { run: await this.recommendationsService.generate(deckId) };
  }

  @Post('dismissals')
  async dismiss(
    @Param('deckId', ParseIntPipe) deckId: number,
    @Body() body: DismissRecommendationDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ dismissal: IDismissalResponse }> {
    const { created, dismissal } = await this.recommendationsService.dismiss(deckId, body.cardIdentifier);
    response.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return { dismissal };
  }

  @Delete('dismissals/:cardIdentifier')
  @HttpCode(HttpStatus.NO_CONTENT)
  async undismiss(
    @Param('deckId', ParseIntPipe) deckId: number,
    @Param('cardIdentifier') cardIdentifier: string,
  ): Promise<void> {
    if (cardIdentifier.length > MAX_CARD_IDENTIFIER_LENGTH) {
      throw new BadRequestException(`cardIdentifier must be at most ${MAX_CARD_IDENTIFIER_LENGTH} characters`);
    }
    await this.recommendationsService.undismiss(deckId, cardIdentifier);
  }

  @Post(':recommendationId/adopt')
  @HttpCode(HttpStatus.CREATED)
  async adopt(
    @Param('deckId', ParseIntPipe) deckId: number,
    @Param('recommendationId', ParseUUIDPipe) recommendationId: string,
    @Body() body: AdoptRecommendationDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<{ replacement: IReplacementResponse }> {
    return { replacement: await this.replacementsService.adopt(user.userId, deckId, recommendationId, body) };
  }
}
