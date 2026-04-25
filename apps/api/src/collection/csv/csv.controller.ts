import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseFilters,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../../auth/dtos/current-user.dto';
import { CsvUploadService } from './csv-upload.service';
import { UploadCsvRequestDto } from './dtos/upload-csv.request.dto';
import { IUploadCsvResponse } from './dtos/upload-csv.response.dto';
import { CsvUploadExceptionFilter } from './csv-upload-exception.filter';

/**
 * Handles `POST /api/collection/csv` — the single write surface for CSV
 * collection imports. The `action` field controls how the upload resolves
 * against existing sources:
 *
 *   auto     → detect + create/report
 *   separate → always create a new source
 *   replace  → cascade-delete target + create new (requires targetSourceId)
 *   update   → diff and apply rows to target (requires targetSourceId)
 *   cancel   → no-op
 *
 * File constraints (enforced by multer):
 *   - Max size: 2 MB (LIMIT_FILE_SIZE → 400 FILE_TOO_LARGE)
 *   - MIME: text/csv, text/plain, application/vnd.ms-excel (fileFilter)
 */
@Controller('collection/csv')
@UseFilters(CsvUploadExceptionFilter)
export class CsvController {
  constructor(private readonly csvUploadService: CsvUploadService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (
        _req: Request,
        file: Express.Multer.File,
        callback: (error: Error | null, acceptFile: boolean) => void,
      ) => {
        const allowed = new Set([
          'text/csv',
          'text/plain',
          'application/vnd.ms-excel',
        ]);
        if (!allowed.has(file.mimetype)) {
          callback(new BadRequestException('INVALID_MIME_TYPE'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadCsvRequestDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<IUploadCsvResponse> {
    // Guard: multer's LIMIT_FILE_SIZE error is raised asynchronously in the
    // interceptor layer and surfaces as a multer error object. NestJS wraps it
    // in an HttpException before reaching here, but we catch the specific case
    // where the file reference is absent due to the limit being hit.
    if (file === undefined || file === null) {
      throw new BadRequestException('MISSING_FILE');
    }

    return this.csvUploadService.handle(
      user.userId,
      file.buffer,
      dto.action ?? 'auto',
      dto.targetSourceId,
      file.originalname,
    );
  }
}
