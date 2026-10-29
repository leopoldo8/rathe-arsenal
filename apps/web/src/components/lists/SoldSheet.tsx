import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import { useMarkSoldMutation, useMarkUnsoldMutation, type IListLine, type ISoldRemovedCopy } from '../../api/lists';
import { cardName } from '../../lib/card-name';
import { copiesToTake, soldOutlook, type ISoldFacts } from './soldModel';
import styles from './SoldSheet.module.css';

export type { ISoldFacts } from './soldModel';

interface ISoldSheetProps {
  readonly listId: number;
  readonly line: IListLine;
  readonly facts: ISoldFacts;
  readonly onClose: () => void;
}

interface IDone {
  readonly soldLineId: number;
  readonly removed: readonly ISoldRemovedCopy[];
  readonly taken: number;
}

function versionLine(line: IListLine, displayName: string): string {
  return [displayName, line.printingLabel, line.condition].filter((part): part is string => part !== null && part !== '').join(' · ');
}

/** "Vendida": how many were sold, then whether the copies leave the collection too. */
export function SoldSheet({ listId, line, facts, onClose }: ISoldSheetProps): React.ReactElement {
  const { t } = useTranslation();
  const [sold, setSold] = useState(line.quantity);
  const [pickingImport, setPickingImport] = useState(false);
  const [done, setDone] = useState<IDone | null>(null);
  const mark = useMarkSoldMutation(listId, line.id);
  const unmark = useMarkUnsoldMutation(listId);
  const displayName = cardName(line.name, line.pitch, (key) => t(key));
  const taken = copiesToTake(facts, sold);
  const outlook = soldOutlook(facts, taken);

  const send = (removeFromCollection: boolean, sourceId?: string): void => {
    mark.mutate(
      { quantity: sold, removeFromCollection, ...(sourceId === undefined ? {} : { sourceId }) },
      {
        onSuccess: (result) => {
          if (!removeFromCollection) return onClose();
          setPickingImport(false);
          setDone({ soldLineId: result.soldLineId, removed: result.removed, taken: result.removed.reduce((sum, copy) => sum + copy.quantity, 0) });
        },
      },
    );
  };

  const takeOut = (): void => {
    if (facts.imports.length > 1) return setPickingImport(true);
    send(true);
  };

  const undo = (): void => {
    if (done === null) return;
    unmark.mutate({ soldLineId: done.soldLineId, restore: done.removed }, { onSuccess: onClose });
  };

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.sheet} aria-describedby={undefined} data-testid="sold-sheet">
          <span className={styles.grip} aria-hidden="true" />
          {done === null ? (
            <>
              {line.quantity > 1 && (
                <>
                  <Dialog.Title className={styles.heading}>{t('lists.sold.howMany')}</Dialog.Title>
                  <p className={styles.lineName}>{versionLine(line, displayName)}</p>
                  <div className={styles.choices} role="group" aria-label={t('lists.sold.howMany')}>
                    {Array.from({ length: line.quantity }, (_, index) => index + 1).map((count) => (
                      <button
                        key={count}
                        type="button"
                        className={styles.choice}
                        aria-pressed={count === sold}
                        onClick={() => setSold(count)}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {pickingImport ? (
                <>
                  <h2 className={styles.heading}>{t('lists.sold.whichImport')}</h2>
                  <ul className={styles.imports}>
                    {facts.imports.map((entry) => (
                      <li key={entry.sourceId}>
                        <button type="button" className={styles.secondary} disabled={mark.isPending} onClick={() => send(true, entry.sourceId)}>
                          {t('lists.sold.importOption', { label: entry.label, count: entry.quantity })}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  {line.quantity === 1 ? (
                    <Dialog.Title className={styles.heading}>{t('lists.sold.collectionQuestion')}</Dialog.Title>
                  ) : (
                    <h2 className={styles.heading}>{t('lists.sold.collectionQuestion')}</h2>
                  )}
                  {line.quantity === 1 && <p className={styles.lineName}>{versionLine(line, displayName)}</p>}
                  <p className={styles.outlook}>
                    {outlook.kind === 'short'
                      ? t('lists.sold.deckShort', { deck: outlook.deck, count: outlook.missing })
                      : outlook.kind === 'kept'
                        ? t('lists.sold.haveLeftHeld', { owned: facts.owned, left: outlook.left, deck: outlook.deck })
                        : t('lists.sold.haveLeft', { owned: facts.owned, left: outlook.left })}
                  </p>
                  <button type="button" className={styles.primary} disabled={mark.isPending || taken === 0} onClick={takeOut}>
                    {t('lists.sold.yes', { count: taken })}
                  </button>
                  <button type="button" className={styles.secondary} disabled={mark.isPending} onClick={() => send(false)}>
                    {t('lists.sold.no')}
                  </button>
                  <p className={styles.hint}>{t('lists.sold.noHint')}</p>
                </>
              )}
              {mark.isError && <p className={styles.error} role="alert">{t('lists.sold.failed')}</p>}
            </>
          ) : (
            <>
              <Dialog.Title className={styles.heading}>
                {done.taken < sold
                  ? `${t('lists.sold.removed', { count: done.taken })} ${t('lists.sold.removedFewer')}`
                  : t('lists.sold.removed', { count: done.taken })}
              </Dialog.Title>
              <button type="button" className={styles.primary} disabled={unmark.isPending} onClick={undo}>
                {t('lists.sold.undo')}
              </button>
              <button type="button" className={styles.secondary} onClick={onClose}>
                {t('lists.sold.close')}
              </button>
              {unmark.isError && <p className={styles.error} role="alert">{t('lists.sold.undoFailed')}</p>}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
