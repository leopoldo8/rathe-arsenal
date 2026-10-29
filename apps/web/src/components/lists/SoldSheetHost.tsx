import React from 'react';
import { useTranslation } from 'react-i18next';
import type { IListLine } from '../../api/lists';
import { useLibraryQuery } from '../../api/library';
import { useSpareQuery } from '../../api/spare';
import { isUnversioned, versionKey } from '../collection-versions/copy-version-labels';
import { SoldSheet } from './SoldSheet';
import type { ISoldFacts } from './soldModel';

interface ISoldSheetHostProps {
  readonly listId: number;
  readonly line: IListLine;
  readonly onClose: () => void;
}

/** Reads the collection and the spare view for the card of a line, then draws the sold sheet over them. */
export function SoldSheetHost({ listId, line, onClose }: ISoldSheetHostProps): React.ReactElement | null {
  const { t } = useTranslation();
  const library = useLibraryQuery();
  const spare = useSpareQuery();
  if (library.data === undefined || spare.data === undefined) return null;

  const card = library.data.cards.find((entry) => entry.cardIdentifier === line.cardIdentifier);
  const lineVersion = { printingCode: line.printingCode, edition: line.edition, finish: line.finish, condition: line.condition ?? '' };
  const byImport = new Map<string, { label: string; quantity: number }>();
  for (const contribution of card?.contributions ?? []) {
    if (versionKey(contribution) !== versionKey(lineVersion) && !isUnversioned(contribution)) continue;
    const label = contribution.kind === 'manual' ? t('csvSources.manualSourceLabel') : contribution.sourceLabel;
    byImport.set(contribution.sourceId, { label, quantity: (byImport.get(contribution.sourceId)?.quantity ?? 0) + contribution.quantity });
  }
  const why = spare.data.why[line.cardIdentifier];
  const facts: ISoldFacts = {
    owned: card?.ownedQuantity ?? 0,
    held: why?.held ?? 0,
    holder: why?.holders[0]?.deckName ?? null,
    imports: [...byImport].map(([sourceId, entry]) => ({ sourceId, ...entry })),
  };
  return <SoldSheet listId={listId} line={line} facts={facts} onClose={onClose} />;
}
