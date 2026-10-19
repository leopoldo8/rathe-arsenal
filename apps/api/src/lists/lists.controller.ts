import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { ICardList, ICardListSummary, IListPrintingOption } from './dtos/card-list.dto';
import { AddLineDto, ApplySuggestionsDto, CreateListDto, UpdateLineDto, UpdateListDto } from './dtos/list-requests.dto';
import { ListLinesService } from './list-lines.service';
import { ListsService } from './lists.service';
import { ParseInt32IdPipe } from './parse-int32-id.pipe';

@Controller('lists')
export class ListsController {
  constructor(
    private readonly lists: ListsService,
    private readonly lines: ListLinesService,
  ) {}

  @Get()
  summaries(@CurrentUser() user: ICurrentUser): Promise<ICardListSummary[]> {
    return this.lists.summaries(user.userId);
  }

  @Post()
  create(@Body() dto: CreateListDto, @CurrentUser() user: ICurrentUser): Promise<ICardList> {
    return this.lists.create(user.userId, dto);
  }

  @Get(':listId')
  get(@Param('listId', ParseInt32IdPipe) listId: number, @CurrentUser() user: ICurrentUser): Promise<ICardList> {
    return this.lists.get(user.userId, listId);
  }

  @Patch(':listId')
  update(
    @Param('listId', ParseInt32IdPipe) listId: number,
    @Body() dto: UpdateListDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<ICardList> {
    return this.lists.update(user.userId, listId, dto);
  }

  @Delete(':listId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('listId', ParseInt32IdPipe) listId: number, @CurrentUser() user: ICurrentUser): Promise<void> {
    await this.lists.remove(user.userId, listId);
  }

  @Post(':listId/lines')
  async addLine(
    @Param('listId', ParseInt32IdPipe) listId: number,
    @Body() dto: AddLineDto,
    @CurrentUser() user: ICurrentUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ICardList> {
    const { list, created } = await this.lines.add(user.userId, listId, dto);
    response.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return list;
  }

  @Patch(':listId/lines/:lineId')
  updateLine(
    @Param('listId', ParseInt32IdPipe) listId: number,
    @Param('lineId', ParseInt32IdPipe) lineId: number,
    @Body() dto: UpdateLineDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<ICardList> {
    return this.lines.update(user.userId, listId, lineId, dto);
  }

  @Delete(':listId/lines/:lineId')
  removeLine(
    @Param('listId', ParseInt32IdPipe) listId: number,
    @Param('lineId', ParseInt32IdPipe) lineId: number,
    @CurrentUser() user: ICurrentUser,
  ): Promise<ICardList> {
    return this.lines.remove(user.userId, listId, lineId);
  }

  @Get(':listId/printings/:cardIdentifier')
  printings(
    @Param('listId', ParseInt32IdPipe) listId: number,
    @Param('cardIdentifier') cardIdentifier: string,
    @CurrentUser() user: ICurrentUser,
  ): Promise<IListPrintingOption[]> {
    return this.lines.printings(user.userId, listId, cardIdentifier);
  }

  @Post(':listId/apply-suggestions')
  @HttpCode(HttpStatus.OK)
  applySuggestions(
    @Param('listId', ParseInt32IdPipe) listId: number,
    @Body() dto: ApplySuggestionsDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<ICardList> {
    return this.lines.applySuggestions(user.userId, listId, dto.lineIds);
  }
}
