import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../../auth/dtos/current-user.dto';
import { IReadImportResult } from '../reader/import-table';
import {
  CreateImportDto,
  ICreateImportResponse,
  MAX_IMPORT_FILE_BYTES,
  ReadImportDto,
  ResolvePendingDto,
} from './dtos/import-requests.dto';
import { ImportsService } from './imports.service';
import { IPendingList, IResolvePendingResponse, PendingService } from './pending.service';

/**
 * Routes:
 *   POST   /api/collection/imports/read   reads a paste or a file, creates nothing
 *   POST   /api/collection/imports        the ready lines become one import, the rest are kept "Para resolver"
 *   GET    /api/collection/pending        the lines kept "Para resolver", by import
 *   PATCH  /api/collection/pending/:id    a kept line becomes a copy of its import
 *   DELETE /api/collection/pending/:id    a kept line is dropped
 */
@Controller('collection')
export class ImportsController {
  constructor(
    private readonly imports: ImportsService,
    private readonly pending: PendingService,
  ) {}

  @Post('imports/read')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_IMPORT_FILE_BYTES } }))
  read(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: ReadImportDto,
  ): IReadImportResult {
    return this.imports.read({ text: dto.text, file: file?.buffer });
  }

  @Post('imports')
  create(@Body() dto: CreateImportDto, @CurrentUser() user: ICurrentUser): Promise<ICreateImportResponse> {
    return this.imports.create(user.userId, dto);
  }

  @Get('pending')
  listPending(@CurrentUser() user: ICurrentUser): Promise<IPendingList> {
    return this.pending.list(user.userId);
  }

  @Patch('pending/:id')
  resolvePending(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolvePendingDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<IResolvePendingResponse> {
    return this.pending.resolve(user.userId, id, dto);
  }

  @Delete('pending/:id')
  @HttpCode(204)
  async removePending(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: ICurrentUser): Promise<void> {
    await this.pending.remove(user.userId, id);
  }
}
