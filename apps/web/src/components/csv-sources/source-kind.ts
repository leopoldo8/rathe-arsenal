import type { ICsvSource } from '../../api/csv-sources';

export type TSourceDisplayKind = 'csv' | 'fabrary' | 'manual';

/** Fabrary imports are stored as kind 'csv'; only the source URL tells them apart. */
export function deriveSourceKind(source: ICsvSource): TSourceDisplayKind {
  if (source.kind === 'manual') return 'manual';
  return source.sourceUrl !== null ? 'fabrary' : 'csv';
}
