import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ShareEventEntity,
  TShareEventKind,
  TShareTargetKind,
} from '../database/entities/share-event.entity';

export interface IShareEventInput {
  readonly kind: TShareEventKind;
  readonly targetKind: TShareTargetKind;
  readonly targetId: number;
  readonly ownerUserId: string;
  readonly actorUserId: string | null;
}

@Injectable()
export class ShareEventsService {
  private readonly logger = new Logger(ShareEventsService.name);

  constructor(
    @InjectRepository(ShareEventEntity)
    private readonly events: Repository<ShareEventEntity>,
  ) {}

  /** Measurement must never break a share, an open or a sign-up, so a failed insert is only logged. */
  async record(input: IShareEventInput): Promise<void> {
    try {
      await this.events.insert({ ...input });
    } catch (error) {
      this.logger.warn({
        event: 'sharing.event.record_failed',
        kind: input.kind,
        targetKind: input.targetKind,
        targetId: input.targetId,
        error: error instanceof Error ? error.message : 'unknown',
      });
    }
  }
}
