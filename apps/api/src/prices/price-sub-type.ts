const FINISH_NAMES: Readonly<Record<string, string>> = {
  Rainbow: 'Rainbow Foil',
  Cold: 'Cold Foil',
  Gold: 'Gold Foil',
};
const EDITION_PREFIXES: Readonly<Record<string, string>> = {
  First: '1st Edition ',
  Unlimited: 'Unlimited Edition ',
};

/**
 * TCGplayer files the foils and editions of one product as sub types of the same product id.
 * Null when no sub type is known (an Alpha printing, an unknown finish): a wrong price is worse than none.
 */
export function printingSubType(foiling: string | null, edition: string | null): string | null {
  const finish = foiling === null ? 'Normal' : FINISH_NAMES[foiling];
  if (finish === undefined) return null;
  if (edition === null) return finish;
  const prefix = EDITION_PREFIXES[edition];
  return prefix === undefined ? null : `${prefix}${finish}`;
}
