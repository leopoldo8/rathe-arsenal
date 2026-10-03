export interface IDeckDetailSearch {
  readonly edit: 1 | undefined;
}

// The router JSON-parses search values: a number serializes as `?edit=1`, a string as `?edit=%221%22`.
export function validateDeckDetailSearch(raw: Record<string, unknown>): IDeckDetailSearch {
  return { edit: raw.edit === 1 || raw.edit === '1' ? 1 : undefined };
}
