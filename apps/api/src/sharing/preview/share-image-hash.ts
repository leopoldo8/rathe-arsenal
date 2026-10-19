import { createHash } from 'crypto';
import type { TShareIntent } from '../../database/entities/share-link.entity';

export const SHARE_IMAGE_LAYOUT_VERSION = 1;

export interface IShareImageHashInput {
  readonly intent: TShareIntent;
  readonly name: string;
  readonly hero: string;
  readonly format: string;
  readonly sharerName: string;
  readonly totalCards: number;
  readonly missingCount: number;
  readonly drawnCardIdentifiers: readonly string[];
  readonly blockedCardIdentifiers: readonly string[];
  readonly shareUrl: string;
  // Drawn on sell-list images only; left out of the payload when absent so deck hashes do not change.
  readonly totalPriceCents?: number | null;
}

/** Hashes everything the image draws, so any change to it yields a new hash and a fresh render. */
export function computeShareImageHash(input: IShareImageHashInput): string {
  const payload = JSON.stringify({
    layoutVersion: SHARE_IMAGE_LAYOUT_VERSION,
    intent: input.intent,
    name: input.name,
    hero: input.hero,
    format: input.format,
    sharerName: input.sharerName,
    totalCards: input.totalCards,
    missingCount: input.missingCount,
    drawn: input.drawnCardIdentifiers,
    blocked: [...input.blockedCardIdentifiers].sort(),
    shareUrl: input.shareUrl,
    ...(input.totalPriceCents === undefined ? {} : { totalPriceCents: input.totalPriceCents }),
  });
  return createHash('sha256').update(payload).digest('hex');
}
