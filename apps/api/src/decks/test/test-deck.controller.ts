import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../../auth/dtos/current-user.dto';
import { ITestDeckResponse, TestDeckRequestDto } from './dtos/test-deck.dto';
import { TestDeckService } from './test-deck.service';

// TODO(U1): apply @Throttle({ default: { limit: 10, ttl: 60_000 } }) once
// @nestjs/throttler lands. Target is 10 req/min/user on this endpoint
// since every call hits Fabrary through the SSRF guard.
@Controller('decks/test')
export class TestDeckController {
  constructor(private readonly testDeckService: TestDeckService) {}

  @Post()
  async test(
    @Body() dto: TestDeckRequestDto,
    @CurrentUser() user: ICurrentUser,
  ): Promise<ITestDeckResponse> {
    return this.testDeckService.run(dto, user);
  }
}
