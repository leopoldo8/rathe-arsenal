import { Global, Module } from '@nestjs/common';
import { FetchGuardService } from './fetch-guard.service';

@Global()
@Module({
  providers: [FetchGuardService],
  exports: [FetchGuardService],
})
export class FetchGuardModule {}
