export interface IDeckDetailSearch {
  readonly edit: '1' | undefined;
}

// The router JSON-parses search values, so a typed `?edit=1` arrives as the number 1.
export function validateDeckDetailSearch(raw: Record<string, unknown>): IDeckDetailSearch {
  return { edit: raw.edit === '1' || raw.edit === 1 ? '1' : undefined };
}
