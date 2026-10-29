import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../../auth/dtos/current-user.dto';
import { CollectionVersionsService } from './collection-versions.service';
import {
  ICardCopiesResponse,
  IMarkSourceVersionsResponse,
  ISourceCopiesResponse,
  MarkSourceVersionsDto,
  MoveCopiesDto,
} from './dtos/version-requests.dto';

/**
 * Routes:
 *   GET   /api/collection/sources/:id/copies                 the import's copies by card and version
 *   PATCH /api/collection/sources/:id/versions               "Marcar de uma vez": copies with no version only
 *   PATCH /api/collection/cards/:cardIdentifier/versions     move copies of one card between versions
 */
@Controller('collection')
export class CollectionVersionsController {
  constructor(private readonly versionsService: CollectionVersionsService) {}

  @Get('sources/:id/copies')
  async copies(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: ICurrentUser,
  ): Promise<ISourceCopiesResponse> {
    return this.versionsService.listSourceCopies(user.userId, id);
  }

  @Patch('sources/:id/versions')
  async markVersions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MarkSourceVersionsDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<IMarkSourceVersionsResponse> {
    return this.versionsService.markSource(user.userId, id, dto);
  }

  @Patch('cards/:cardIdentifier/versions')
  async moveCopies(
    @Param('cardIdentifier') cardIdentifier: string,
    @Body() dto: MoveCopiesDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<ICardCopiesResponse> {
    return this.versionsService.moveCopies(user.userId, cardIdentifier, dto);
  }
}
