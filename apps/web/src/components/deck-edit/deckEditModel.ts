import type { IPatchDeckBody, TDeckStatus } from '../../api/decks';
import type { IDeckDetailResponse } from '../../api/deck-detail';
import type { ITagResponse } from '../../api/tags';

export const STATUS_SEGMENT_ORDER: readonly TDeckStatus[] = [
  'active',
  'ready',
  'building',
  'idea',
  'retired',
];

export const NAME_MAX_LENGTH = 120;
export const NOTES_MAX_LENGTH = 2000;

export interface IDeckEditFields {
  readonly name: string;
  readonly format: string;
  readonly status: TDeckStatus;
  readonly notes: string;
}

export function fieldsFromDeck(
  deck: Pick<IDeckDetailResponse, 'name' | 'format' | 'status' | 'notes'>,
): IDeckEditFields {
  return {
    name: deck.name,
    format: deck.format,
    status: deck.status,
    notes: deck.notes ?? '',
  };
}

function normalizeNotes(notes: string): string {
  return notes.trim() === '' ? '' : notes;
}

export function isNameValid(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= NAME_MAX_LENGTH;
}

export function buildPatchBody(initial: IDeckEditFields, draft: IDeckEditFields): IPatchDeckBody {
  const body: {
    name?: string;
    format?: string;
    status?: TDeckStatus;
    notes?: string | null;
  } = {};
  if (draft.name.trim() !== initial.name.trim()) body.name = draft.name.trim();
  if (draft.format !== initial.format) body.format = draft.format;
  if (draft.status !== initial.status) body.status = draft.status;
  const notes = normalizeNotes(draft.notes);
  if (notes !== normalizeNotes(initial.notes)) body.notes = notes === '' ? null : notes;
  return body;
}

export function countChanges(initial: IDeckEditFields, draft: IDeckEditFields): number {
  return Object.keys(buildPatchBody(initial, draft)).length;
}

export function resolveDeckTags(
  names: readonly string[],
  allTags: readonly ITagResponse[],
): ITagResponse[] {
  return names
    .map((name) => allTags.find((tag) => tag.name === name))
    .filter((tag): tag is ITagResponse => tag !== undefined);
}
