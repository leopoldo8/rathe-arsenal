export interface ISharedDeckSearch {
  readonly view?: 'missing';
}

/** Anything but `missing` is dropped, so an unknown `?view=` value shows the full deck. */
export function validateSharedDeckSearch(raw: Record<string, unknown>): ISharedDeckSearch {
  return raw.view === 'missing' ? { view: 'missing' } : {};
}
