import { Injectable, Logger } from '@nestjs/common';
import { TReferredVia } from '../database/entities/user.entity';
import { TShareTargetKind } from '../database/entities/share-event.entity';
import { TDeckShareIntent, TShareIntent } from '../database/entities/share-link.entity';
import { SharedDeckLookup } from './shared-deck-lookup';
import { SharedListLookup } from './shared-list-lookup';

const VIA_BY_INTENT: Readonly<Record<TDeckShareIntent, TReferredVia>> = { deck: 'deck', missing: 'want', quote: 'quote' };

export interface IShareReferral {
  readonly ownerUserId: string;
  readonly targetKind: TShareTargetKind;
  readonly targetId: number;
  readonly intent: TShareIntent;
  readonly via: TReferredVia;
}

@Injectable()
export class ShareReferralService {
  private readonly logger = new Logger(ShareReferralService.name);

  constructor(
    private readonly lookup: SharedDeckLookup,
    private readonly listLookup: SharedListLookup,
  ) {}

  /** Null for any token that is not a live deck or list link; sign-up must behave the same either way. */
  async resolve(token: unknown): Promise<IShareReferral | null> {
    try {
      const live = await this.lookup.findLive(token);
      if (!live) return await this.resolveList(token);
      return {
        ownerUserId: live.owner.id,
        targetKind: 'deck',
        targetId: live.deck.id,
        intent: live.link.intent,
        via: VIA_BY_INTENT[live.link.intent],
      };
    } catch (error) {
      this.logger.warn({
        event: 'sharing.referral.resolve_failed',
        error: error instanceof Error ? error.message : 'unknown',
      });
      return null;
    }
  }

  private async resolveList(token: unknown): Promise<IShareReferral | null> {
    const live = await this.listLookup.findLive(token);
    if (!live) return null;
    return {
      ownerUserId: live.owner.id,
      targetKind: 'list',
      targetId: live.list.id,
      intent: live.link.intent,
      via: live.link.intent,
    };
  }
}
