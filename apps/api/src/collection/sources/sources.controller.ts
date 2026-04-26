import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../../auth/dtos/current-user.dto';
import { SourcesService, IPreviewDeleteResult, IDeleteSourceResult } from './sources.service';
import {
  FabraryImportService,
  IFabraryImportResult,
} from './fabrary-import.service';
import { PatchSourceDto } from './dtos/patch-source.dto';
import { ImportFromFabraryDto } from './dtos/import-from-fabrary.dto';
import { CsvSourceEntity } from '../../database/entities/csv-source.entity';

/**
 * Handles CRUD operations on `csv_source` rows (kind='csv' only).
 * The manual source is not exposed here; it is managed internally by
 * `SourcesService.ensureManualSource`.
 *
 * Routes:
 *   GET    /api/collection/sources         — list all csv sources for the user
 *   PATCH  /api/collection/sources/:id     — rename or toggle active
 *   DELETE /api/collection/sources/:id     — preview (with ?preview=true) or delete
 *
 * Auth: the global `AuthGuard` applied in `AppModule` / the auth middleware
 * protects all routes inside the `collection` path — matching the pattern
 * used by `CollectionController`, `CsvController`, and `LibraryController`.
 */
@Controller('collection/sources')
export class SourcesController {
  constructor(
    private readonly sourcesService: SourcesService,
    private readonly fabraryImportService: FabraryImportService,
  ) {}

  /**
   * Imports the cards of a public Fabrary deck into the user's library
   * **as a new source**, without creating a tracked deck. The
   * library-only flow is the third add-cards method alongside Manual
   * search and CSV upload.
   */
  @Post('from-fabrary')
  @HttpCode(201)
  async importFromFabrary(
    @Body() dto: ImportFromFabraryDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<IFabraryImportResult> {
    return this.fabraryImportService.importFromUrl(user.userId, dto.url);
  }

  @Get()
  async list(
    @CurrentUser() user: ICurrentUser,
  ): Promise<CsvSourceEntity[]> {
    return this.sourcesService.list(user.userId);
  }

  @Patch(':id')
  async patch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchSourceDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<CsvSourceEntity> {
    const options: { active?: boolean; label?: string } = {};
    if (dto.active !== undefined) options.active = dto.active;
    if (dto.label !== undefined) options.label = dto.label;
    return this.sourcesService.patch(user.userId, id, options);
  }

  @Delete(':id')
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('preview') preview: string | undefined,
    @CurrentUser() user: ICurrentUser,
  ): Promise<IPreviewDeleteResult | IDeleteSourceResult> {
    if (preview === 'true' || preview === '1') {
      return this.sourcesService.previewDelete(user.userId, id);
    }
    return this.sourcesService.delete(user.userId, id);
  }
}
