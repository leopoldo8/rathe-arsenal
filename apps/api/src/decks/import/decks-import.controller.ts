import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../../auth/dtos/current-user.dto';
import { ImportDecksRequestDto } from './dtos/import-decks.request.dto';
import { IImportDecksResponse } from './dtos/import-decks.response.dto';
import { DecksImportService } from './decks-import.service';

@Controller('decks/import')
export class DecksImportController {
  constructor(private readonly decksImportService: DecksImportService) {}

  @Post()
  async importDecks(
    @Body() dto: ImportDecksRequestDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<IImportDecksResponse> {
    return this.decksImportService.run(dto, user);
  }
}
