/**
 * useCompositionDraft.schema.ts — Zod schema for the localStorage draft payload.
 *
 * Used by useCompositionDraft to validate any restored draft from localStorage.
 * Failures are silently discarded (the key is removed); no errors are surfaced.
 *
 * Version field provides forward-compat: if a future migration changes the
 * shape and bumps version to 'v2', existing 'v1' payloads will fail schema
 * validation and be silently discarded, letting users start clean.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Slot enum — must stay in sync with TDraftSlot in useCompositionDraft.ts
// ---------------------------------------------------------------------------

export const DRAFT_SLOT_VALUES = [
  'mainboard',
  'hero',
  'weapon',
  'equipment',
  'other',
] as const;

// ---------------------------------------------------------------------------
// Supported formats — kept intentionally loose: the server is the authority
// on valid format names, so we only reject obviously invalid shapes.
// The max-length guard prevents excessively large strings in tampered payloads.
// ---------------------------------------------------------------------------

const FORMAT_MAX_LENGTH = 64;
const IDENTIFIER_MAX_LENGTH = 64;

// ---------------------------------------------------------------------------
// Draft card schema
// ---------------------------------------------------------------------------

export const draftCardSchema = z.object({
  cardIdentifier: z.string().max(IDENTIFIER_MAX_LENGTH),
  quantity: z.number().int().min(1).max(4),
  slot: z.enum(DRAFT_SLOT_VALUES),
});

// ---------------------------------------------------------------------------
// Full draft payload schema
// ---------------------------------------------------------------------------

export const compositionDraftPayloadSchema = z.object({
  version: z.literal('v1'),
  heroIdentifier: z.string().max(IDENTIFIER_MAX_LENGTH).nullable(),
  format: z.string().max(FORMAT_MAX_LENGTH),
  cards: z.array(draftCardSchema),
});

export type TCompositionDraftPayload = z.infer<typeof compositionDraftPayloadSchema>;
