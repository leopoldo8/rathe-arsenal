import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import {
  DecisionsService,
  IBulkUpsertResult,
} from '../decks/decisions/decisions.service';
import {
  ReviewAggregateService,
  ISubstitutionRow,
  TReviewState,
} from './review-aggregate.service';
import { BulkReviewsRequestDto } from './dtos/bulk-reviews.request.dto';

/**
 * Query DTO for `GET /api/reviews`.
 */
class GetReviewsQueryDto {
  @IsOptional()
  @IsIn(['pending', 'approved', 'rejected', 'all'])
  state?: TReviewState | 'all';
}

/**
 * Owns the `/api/reviews/*` routes introduced in Plan B.
 *
 * JwtAuthGuard is applied globally via APP_GUARD in `AppModule`, so all
 * routes here require a valid JWT without additional decorators.
 *
 * - GET  /api/reviews?state=pending|approved|rejected|all (U5)
 * - POST /api/reviews/bulk (U6)
 */
@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly decisionsService: DecisionsService,
    private readonly reviewAggregateService: ReviewAggregateService,
  ) {}

  /**
   * Return cross-deck substitution rows, optionally filtered by state.
   *
   * `GET /api/reviews?state=pending|approved|rejected|all`
   *
   * Default state: `pending`. Returns rows from the latest snapshot's
   * `breakdown.substituted[]` for every tracked deck the user owns,
   * with decision state derived from `substitute_decision` rows.
   *
   * Response: `{ rows: ISubstitutionRow[] }`
   */
  @Get()
  async list(
    @Query() query: GetReviewsQueryDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<{ rows: ISubstitutionRow[] }> {
    const stateFilter = query.state ?? 'pending';
    const rows = await this.reviewAggregateService.listSubstitutionRows(
      user.userId,
      stateFilter,
    );
    return { rows };
  }

  /**
   * Apply up to 200 review operations (decision upserts and resets) in a
   * single atomic transaction, then recompute readiness per affected deck.
   *
   * `POST /api/reviews/bulk`
   *
   * Hard cap: 200 operations per request. Exceeding this limit returns HTTP
   * 413 `TOO_MANY_OPERATIONS` to prevent enumeration or DoS via oversized
   * batches. The DTO layer also enforces `@ArrayMaxSize(200)` so this
   * in-controller check is a belt-and-suspenders backstop.
   *
   * Response on success:
   *   `{ succeeded: N, failed: [...pre-validation failures...] }`
   *
   * Response on transaction abort:
   *   `{ succeeded: 0, failed: [...all validated ops...], transactionError }`
   */
  @Post('bulk')
  @HttpCode(HttpStatus.OK)
  async bulk(
    @Body() body: BulkReviewsRequestDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<IBulkUpsertResult> {
    // Hard cap — belt-and-suspenders beyond the DTO @ArrayMaxSize(200).
    if (body.operations.length > 200) {
      throw new HttpException(
        { code: 'TOO_MANY_OPERATIONS', message: 'operations must not exceed 200 items' },
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    return this.decisionsService.bulkUpsert(user.userId, body.operations);
  }
}
