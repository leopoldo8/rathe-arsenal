import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { OwnsTrackedDeckGuard } from '../auth/guards/owns-tracked-deck.guard';
import { AlternativesService, IAlternativesResponse } from './alternatives.service';
import { AlternativesQueryDto } from './dtos/alternatives-query.dto';
import { PickReplacementDto } from './dtos/pick-replacement.dto';
import { IReplacementResponse, ReplacementsService } from './replacements.service';

@Controller()
export class ReplacementsController {
  constructor(
    private readonly alternativesService: AlternativesService,
    private readonly replacementsService: ReplacementsService,
  ) {}

  @Get('decks/:deckId/alternatives')
  @UseGuards(OwnsTrackedDeckGuard)
  listAlternatives(
    @Param('deckId', ParseIntPipe) deckId: number,
    @Query() query: AlternativesQueryDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<IAlternativesResponse> {
    return this.alternativesService.list({
      userId: user.userId,
      deckId,
      cardIdentifier: query.cardIdentifier,
      slot: query.slot,
      query: query.q,
    });
  }

  @Post('decks/:deckId/replacements')
  @UseGuards(OwnsTrackedDeckGuard)
  @HttpCode(HttpStatus.CREATED)
  async pick(
    @Param('deckId', ParseIntPipe) deckId: number,
    @Body() body: PickReplacementDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<{ replacement: IReplacementResponse }> {
    return { replacement: await this.replacementsService.pick(user.userId, deckId, body) };
  }

  @Post('replacements/:id/revert')
  @HttpCode(HttpStatus.OK)
  async revert(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: ICurrentUser,
  ): Promise<{ replacement: IReplacementResponse }> {
    return { replacement: await this.replacementsService.resolve(user.userId, id, 'revert') };
  }

  @Post('replacements/:id/keep')
  @HttpCode(HttpStatus.OK)
  async keep(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: ICurrentUser,
  ): Promise<{ replacement: IReplacementResponse }> {
    return { replacement: await this.replacementsService.resolve(user.userId, id, 'keep') };
  }
}
