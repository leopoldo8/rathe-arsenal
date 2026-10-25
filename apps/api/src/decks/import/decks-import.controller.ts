import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../../auth/dtos/current-user.dto';
import { ImportDecksRequestDto, PreviewDeckRequestDto } from './dtos/import-decks.request.dto';
import { IFabraryDeckPreview, IImportDecksResponse } from './dtos/import-decks.response.dto';
import { DecksImportService } from './decks-import.service';

@Controller('decks/import')
export class DecksImportController {
  constructor(private readonly decksImportService: DecksImportService) {}

  @Post('preview')
  async previewDeck(
    @Body() dto: PreviewDeckRequestDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<IFabraryDeckPreview> {
    return this.decksImportService.preview(dto.text, user);
  }

  @Post()
  async importDecks(
    @Body() dto: ImportDecksRequestDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<IImportDecksResponse> {
    return this.decksImportService.run(dto, user);
  }
}
