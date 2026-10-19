import { ITcgcsvGroup } from './tcgcsv-parse';

export interface ISetRef {
  readonly name: string;
  readonly code: string;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** By set name first, then by the set code against the group abbreviation; null when neither matches. */
export function mapSetToGroup(set: ISetRef, groups: readonly ITcgcsvGroup[]): number | null {
  const byName = groups.find((group) => normalize(group.name) === normalize(set.name));
  if (byName) return byName.groupId;
  const byAbbreviation = groups.find((group) => group.abbreviation !== null && normalize(group.abbreviation) === normalize(set.code));
  return byAbbreviation?.groupId ?? null;
}
