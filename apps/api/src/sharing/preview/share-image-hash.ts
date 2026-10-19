import { createHash } from 'crypto';

export const SHARE_IMAGE_LAYOUT_VERSION = 1;

export interface IShareImageHashInput {
  readonly name: string;
  readonly hero: string;
  readonly format: string;
  readonly sharerName: string;
  readonly totalCards: number;
  readonly drawnCardIdentifiers: readonly string[];
  readonly blockedCardIdentifiers: readonly string[];
  readonly shareUrl: string;
}

/** Hashes everything the image draws, so any change to it yields a new hash and a fresh render. */
export function computeShareImageHash(input: IShareImageHashInput): string {
  const payload = JSON.stringify({
    layoutVersion: SHARE_IMAGE_LAYOUT_VERSION,
    name: input.name,
    hero: input.hero,
    format: input.format,
    sharerName: input.sharerName,
    totalCards: input.totalCards,
    drawn: input.drawnCardIdentifiers,
    blocked: [...input.blockedCardIdentifiers].sort(),
    shareUrl: input.shareUrl,
  });
  return createHash('sha256').update(payload).digest('hex');
}
