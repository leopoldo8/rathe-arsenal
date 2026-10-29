import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';

export interface IHealthResponse {
  status: 'ok';
  timestamp: string;
  /** The git commit this deploy was built from (Railway sets it for GitHub deploys); null elsewhere. */
  commit: string | null;
}

@Controller('health')
@SkipThrottle()
export class HealthController {
  @Public()
  @Get()
  check(): IHealthResponse {
    return { status: 'ok', timestamp: new Date().toISOString(), commit: process.env['RAILWAY_GIT_COMMIT_SHA'] ?? null };
  }
}
