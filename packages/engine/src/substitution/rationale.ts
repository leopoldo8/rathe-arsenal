import { ICatalogCard } from '../catalog/types';

function pitchLabel(pitch: number | null): string {
  switch (pitch) {
    case 1: return 'red';
    case 2: return 'yellow';
    case 3: return 'blue';
    default: return 'colorless';
  }
}

function powerNote(missing: ICatalogCard, substitute: ICatalogCard): string {
  const mp = missing.power ?? 0;
  const sp = substitute.power ?? 0;
  const delta = sp - mp;

  if (delta === 0) return 'same power';
  if (delta > 0) return `+${delta} power`;
  return `${delta} power`;
}

function defenseNote(missing: ICatalogCard, substitute: ICatalogCard): string {
  const md = missing.defense ?? 0;
  const sd = substitute.defense ?? 0;
  const delta = sd - md;

  if (delta === 0) return 'same defense';
  if (delta > 0) return `+${delta} defense`;
  return `${delta} defense`;
}

function sharedKeywords(missing: ICatalogCard, substitute: ICatalogCard): readonly string[] {
  const subKeywords = new Set(substitute.keywords);
  return missing.keywords.filter((kw) => subKeywords.has(kw));
}

/**
 * Build a human-readable rationale for why a substitute card was chosen.
 */
export function composeRationale(
  missing: ICatalogCard,
  substitute: ICatalogCard,
): string {
  const pitch = pitchLabel(missing.pitch);

  const missingClassSet = new Set(missing.classes);
  const commonClasses = substitute.classes.filter((c) => missingClassSet.has(c));
  const classLabel = commonClasses.length > 0
    ? commonClasses.join(', ')
    : 'shared';

  const pNote = powerNote(missing, substitute);
  const dNote = defenseNote(missing, substitute);
  const shared = sharedKeywords(missing, substitute);
  const kwList = shared.length > 0 ? shared.join(', ') : 'no';

  return `Same pitch (${pitch}), same ${classLabel} class, ${pNote}, ${dNote}, shared ${kwList} keywords.`;
}
