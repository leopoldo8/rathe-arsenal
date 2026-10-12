import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { AcceptLanguage } from '../common/i18n/accept-language.decorator';
import { TLocale } from '../common/i18n/resolve-locale';
import { ChatAccessGuard } from './chat-access.guard';
import { ChatBudgetService, IChatUsageResponse } from './chat-budget.service';
import { ChatProposalsService, TApplyResponse } from './chat-proposals.service';
import { ChatService, IConversationSummary, IConversationView } from './chat.service';
import { CreateConversationDto } from './dtos/create-conversation.dto';
import { SendMessageDto } from './dtos/send-message.dto';

export const SEND_LIMIT_PER_MINUTE = 20;
const SEND_THROTTLE = { default: { limit: SEND_LIMIT_PER_MINUTE, ttl: 60_000 } };

@Controller('chat')
@UseGuards(ChatAccessGuard)
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly budget: ChatBudgetService,
    private readonly proposals: ChatProposalsService,
  ) {}

  @Get('conversations')
  list(@CurrentUser() user: ICurrentUser): Promise<IConversationSummary[]> {
    return this.chat.list(user.userId);
  }

  @Post('conversations')
  create(@CurrentUser() user: ICurrentUser, @Body() dto: CreateConversationDto): Promise<{ id: string }> {
    return this.chat.create(user.userId, dto.trackedDeckId);
  }

  @Get('conversations/:id')
  read(@CurrentUser() user: ICurrentUser, @Param('id', ParseUUIDPipe) id: string): Promise<IConversationView> {
    return this.chat.read(user.userId, id);
  }

  @Post('conversations/:id/messages')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(SEND_THROTTLE)
  send(
    @CurrentUser() user: ICurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
    @AcceptLanguage() locale: TLocale,
  ): Promise<{ userMessageId: string; assistantMessageId: string }> {
    return this.chat.send(user.userId, id, dto.text, locale);
  }

  @Post('conversations/:id/messages/:messageId/retry')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle(SEND_THROTTLE)
  retry(
    @CurrentUser() user: ICurrentUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ): Promise<{ assistantMessageId: string }> {
    return this.chat.retry(user.userId, id, messageId);
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: ICurrentUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.chat.remove(user.userId, id);
  }

  @Get('usage')
  usage(@CurrentUser() user: ICurrentUser): Promise<IChatUsageResponse> {
    return this.budget.usage(user.userId);
  }

  @Post('proposals/:id/apply')
  apply(@CurrentUser() user: ICurrentUser, @Param('id', ParseUUIDPipe) id: string): Promise<TApplyResponse> {
    return this.proposals.apply(user.userId, id);
  }

  @Post('proposals/:id/dismiss')
  @HttpCode(HttpStatus.OK)
  dismiss(@CurrentUser() user: ICurrentUser, @Param('id', ParseUUIDPipe) id: string): Promise<{ id: string; status: 'dismissed' }> {
    return this.proposals.dismiss(user.userId, id);
  }
}
