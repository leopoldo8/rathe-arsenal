import { Injectable, Logger } from '@nestjs/common';
import { TReferredVia } from '../database/entities/user.entity';
import { TShareTargetKind } from '../database/entities/share-event.entity';
import { SharedDeckLookup } from './shared-deck-lookup';

export interface IShareReferral {
  readonly ownerUserId: string;
  readonly targetKind: TShareTargetKind;
  readonly targetId: number;
  readonly via: TReferredVia;
}

@Injectable()
export class ShareReferralService {
  private readonly logger = new Logger(ShareReferralService.name);

  constructor(private readonly lookup: SharedDeckLookup) {}

  /** Null for any token that is not a live deck link; sign-up must behave the same either way. */
  async resolve(token: unknown): Promise<IShareReferral | null> {
    try {
      const live = await this.lookup.findLive(token);
      if (!live) return null;
      return {
        ownerUserId: live.owner.id,
        targetKind: 'deck',
        targetId: live.deck.id,
        via: 'deck',
      };
    } catch (error) {
      this.logger.warn({
        event: 'sharing.referral.resolve_failed',
        error: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }
}
