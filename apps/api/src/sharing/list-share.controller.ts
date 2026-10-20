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
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { ParseInt32IdPipe } from '../lists/parse-int32-id.pipe';
import { ILinkState } from './dtos/share-state.dto';
import { UpdateShareDto } from './dtos/update-share.dto';
import { ListShareService } from './list-share.service';

const MINUTE_MS = 60 * 1000;
const SHARE_TOGGLE_LIMIT = 30;

@Controller('lists/:listId/share')
export class ListShareController {
  constructor(private readonly shares: ListShareService) {}

  // A literal JSON null (not an empty body) so the web client reads "off" as null.
  @Get()
  async get(
    @Param('listId', ParseInt32IdPipe) listId: number,
    @CurrentUser() user: ICurrentUser,
    @Res() response: Response,
  ): Promise<void> {
    const state = await this.shares.getState(user.userId, listId);
    response.status(HttpStatus.OK).json(state);
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: SHARE_TOGGLE_LIMIT, ttl: MINUTE_MS } })
  async enable(
    @Param('listId', ParseInt32IdPipe) listId: number,
    @CurrentUser() user: ICurrentUser,
  ): Promise<ILinkState> {
    return this.shares.enable(user.userId, listId);
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: SHARE_TOGGLE_LIMIT, ttl: MINUTE_MS } })
  async update(
    @Param('listId', ParseInt32IdPipe) listId: number,
    @Body() dto: UpdateShareDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<ILinkState> {
    return this.shares.setShowContact(user.userId, listId, dto.showContact);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: SHARE_TOGGLE_LIMIT, ttl: MINUTE_MS } })
  async disable(
    @Param('listId', ParseInt32IdPipe) listId: number,
    @CurrentUser() user: ICurrentUser,
  ): Promise<void> {
    await this.shares.disable(user.userId, listId);
  }
}
