export interface IQuoteRowDraft {
  /** Copies the store has of the card. */
  readonly have: number;
  /** The unit price as typed, in reais. */
  readonly price: string;
  readonly note: string;
}

/** What the store owner has typed, by card. It lives only on this device. */
export type TQuoteDraft = Readonly<Record<string, IQuoteRowDraft>>;

export function quoteDraftKey(token: string): string {
  return `ra.quoteDraft.${token}`;
}

function isRowDraft(value: unknown): value is IQuoteRowDraft {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row['have'] === 'number' && typeof row['price'] === 'string' && typeof row['note'] === 'string';
}

/** The draft saved for this token on this device; empty when there is none, when it cannot be read or storage is blocked. */
export function readQuoteDraft(token: string): TQuoteDraft {
  try {
    const stored = localStorage.getItem(quoteDraftKey(token));
    if (stored === null) return {};
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const entries = Object.entries(parsed as Record<string, unknown>);
    return entries.every(([, row]) => isRowDraft(row)) ? (parsed as TQuoteDraft) : {};
  } catch {
    return {};
  }
}

/** Saves the draft for this token; the page keeps working when storage is blocked, it just forgets. */
export function writeQuoteDraft(token: string, draft: TQuoteDraft): void {
  try {
    localStorage.setItem(quoteDraftKey(token), JSON.stringify(draft));
  } catch {
    // Private mode or blocked storage: the draft lives only in this visit.
  }
}
