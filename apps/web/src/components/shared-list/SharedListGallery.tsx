import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ISharedListLine, ISharedListResponse } from '../../api/shared-lists';
import { formatBrl } from '../lists/listsModel';
import { SharedGallery } from '../shared-deck/SharedGallery';
import type { TMatchesByLine } from './sharedListModel';
import styles from './SharedListPage.module.css';

interface ISharedListGalleryProps {
  readonly list: ISharedListResponse;
  /** The logged-in visitor's matches; empty for anonymous visitors and the owner. */
  readonly matches: TMatchesByLine;
}

/** Every line of the list as a large card, sold ones marked and dimmed. */
export function SharedListGallery({ list, matches }: ISharedListGalleryProps): React.ReactElement {
  const { t } = useTranslation();

  function overlayFor(line: ISharedListLine): React.ReactNode {
    if (line.sold) {
      return (
        <span className={styles.soldVeil} data-testid="shared-line-sold">
          <span>{t('sharing.sharedList.sold')}</span>
        </span>
      );
    }
    const match = matches.get(line.id);
    if (list.kind === 'want' && match !== undefined && match.owned > 0) {
      return (
        <span className={`${styles.ribbon} ${styles.ribbonOwned}`} data-testid="shared-line-owned">
          {t('sharing.sharedList.youHave', { count: match.owned })}
        </span>
      );
    }
    if (list.kind === 'sell' && match !== undefined && match.missingInDecks > 0) {
      return (
        <span className={`${styles.ribbon} ${styles.ribbonMissing}`} data-testid="shared-line-missing">
          {t('sharing.sharedList.missingInDecks', { count: match.missingInDecks })}
        </span>
      );
    }
    return null;
  }

  function noteFor(line: ISharedListLine): React.ReactNode {
    if (list.kind !== 'sell') return undefined;
    const hasDetails = line.printingLabel !== null || line.condition !== null || line.priceCents !== null;
    if (!hasDetails) return undefined;
    return (
      <span className={styles.details} data-testid="shared-line-details">
        {line.printingLabel !== null && <span className={styles.printing}>{line.printingLabel}</span>}
        {line.condition !== null && <span className={styles.condition}>{line.condition}</span>}
        {line.priceCents !== null && (
          <span className={styles.price}>{t('lists.text.each', { price: formatBrl(line.priceCents) })}</span>
        )}
      </span>
    );
  }

  return (
    <SharedGallery
      cards={list.lines}
      countAs="quantity"
      keyFor={(line) => String(line.id)}
      dimmed={(line) => line.sold}
      overlayFor={overlayFor}
      noteFor={noteFor}
      formatQuantity={(count) => t('sharing.list.quantity', { count })}
    />
  );
}
