export type TPurgePlan =
  | { readonly mode: 'all' }
  | { readonly mode: 'cards'; readonly cardIdentifiers: readonly string[] };

export interface IPurgeStatement {
  readonly sql: string;
  readonly params: readonly unknown[];
}

export class PurgeUsageError extends Error {}

export const PURGE_USAGE =
  'Usage: pnpm share-images:purge -- --all | --card <cardIdentifier> [--card <cardIdentifier> ...]';

export function parsePurgeArgs(argv: readonly string[]): TPurgePlan {
  const cards: string[] = [];
  let all = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--') continue;
    if (arg === '--all') {
      all = true;
    } else if (arg === '--card') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new PurgeUsageError('--card needs a card identifier');
      cards.push(value.trim());
      index += 1;
    } else {
      throw new PurgeUsageError(`Unknown argument: ${arg}`);
    }
  }

  const distinctCards = [...new Set(cards.filter((card) => card.length > 0))];
  if (all && distinctCards.length > 0) throw new PurgeUsageError('Use either --all or --card, not both');
  if (all) return { mode: 'all' };
  if (distinctCards.length === 0) throw new PurgeUsageError('Pass --all or at least one --card');
  return { mode: 'cards', cardIdentifiers: distinctCards };
}

/** Blocks come first so a request racing the purge can no longer render the card back into a new image. */
export function buildPurgeStatements(plan: TPurgePlan): IPurgeStatement[] {
  if (plan.mode === 'all') return [{ sql: 'DELETE FROM "share_image"', params: [] }];
  return [
    {
      sql: `INSERT INTO "card_art_block" ("cardIdentifier") SELECT unnest($1::text[]) ON CONFLICT DO NOTHING`,
      params: [plan.cardIdentifiers],
    },
    {
      sql: 'DELETE FROM "share_image" WHERE "cardIdentifiers" && $1::text[]',
      params: [plan.cardIdentifiers],
    },
  ];
}
