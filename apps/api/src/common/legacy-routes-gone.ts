export const SWAPS_MIGRATION_PAYLOAD = {
  code: 'DEPRECATED' as const,
  migration:
    'use /api/swaps (GET) and /api/swaps/:id/approve, /api/swaps/:id/reject, /api/swaps/:id/revert, /api/swaps/:id/restore, /api/swaps/:id/outcome (POST)',
};
