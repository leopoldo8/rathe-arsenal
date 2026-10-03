import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { ISwapRow } from './build-swap-row';
import { ListSwapsQueryDto } from './dtos/list-swaps.query.dto';
import { RejectSwapDto } from './dtos/reject-swap.dto';
import { SwapOutcomeDto } from './dtos/swap-outcome.dto';
import { ISwapMutationResult, SwapsService } from './swaps.service';

@Controller('swaps')
export class SwapsController {
  constructor(private readonly swapsService: SwapsService) {}

  @Get()
  async list(
    @Query() query: ListSwapsQueryDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<{ rows: ISwapRow[] }> {
    const rows = await this.swapsService.list(user.userId, query.state ?? 'pending');
    return { rows };
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: ICurrentUser,
  ): Promise<ISwapMutationResult> {
    return this.swapsService.mutate(user.userId, id, { kind: 'approve' });
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RejectSwapDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<ISwapMutationResult> {
    return this.swapsService.mutate(user.userId, id, {
      kind: 'reject',
      reason: body.reason,
      note: body.note,
    });
  }

  @Post(':id/revert')
  @HttpCode(HttpStatus.OK)
  revert(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: ICurrentUser,
  ): Promise<ISwapMutationResult> {
    return this.swapsService.mutate(user.userId, id, { kind: 'revert' });
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: ICurrentUser,
  ): Promise<ISwapMutationResult> {
    return this.swapsService.mutate(user.userId, id, { kind: 'restore' });
  }

  @Post(':id/outcome')
  @HttpCode(HttpStatus.OK)
  outcome(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SwapOutcomeDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<ISwapMutationResult> {
    return this.swapsService.mutate(user.userId, id, { kind: 'outcome', outcome: body.outcome });
  }
}
