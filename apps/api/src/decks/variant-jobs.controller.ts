import { Controller, Get } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ICurrentUser } from '../auth/dtos/current-user.dto';
import { TrackedDeckEntity } from '../database/entities/tracked-deck.entity';
import { VariantFetchQueueService } from '../stores/variant-fetch-queue.service';
import {
  IVariantJobDto,
  IVariantJobsResponse,
} from './dtos/variant-job.response.dto';

/**
 * GET /variant-jobs
 *
 * Returns all active/recent variant-fetch jobs for the authenticated user,
 * enriched with the deck name from `tracked_deck`. Used by the global
 * progress pill in the UI.
 *
 * Authentication: handled by the global JwtAuthGuard (APP_GUARD in AppModule).
 */
@Controller('variant-jobs')
export class VariantJobsController {
  constructor(
    private readonly queue: VariantFetchQueueService,
    @InjectRepository(TrackedDeckEntity)
    private readonly deckRepo: Repository<TrackedDeckEntity>,
  ) {}

  @Get()
  async listJobs(@CurrentUser() user: ICurrentUser): Promise<IVariantJobsResponse> {
    const jobs = await this.queue.listForUser(user.userId);

    if (jobs.length === 0) {
      return { jobs: [], etaSeconds: 0 };
    }

    // Batch-load deck names for all jobs in one query.
    const deckIds = [...new Set(jobs.map((j) => j.deckId))];
    const decks = await this.deckRepo.find({ where: { id: In(deckIds) } });
    const deckNameById = new Map(decks.map((d) => [d.id, d.name]));

    const jobDtos: IVariantJobDto[] = jobs.map((j) => ({
      jobId: j.id,
      deckId: j.deckId,
      deckName: deckNameById.get(j.deckId) ?? `Deck ${j.deckId}`,
      status: j.status,
      total: j.total,
      completed: j.completed,
      failed: j.failed,
    }));

    return {
      jobs: jobDtos,
      etaSeconds: this.queue.computeEtaSeconds(jobs),
    };
  }
}
