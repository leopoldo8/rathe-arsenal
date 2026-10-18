import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ISharedCard } from '../../api/shared-decks';
import { SharedCardRow } from './SharedCardRow';
import { groupSharedCards, type ISharedCardGroup } from './sharedDeckModel';
import styles from './SharedDeckList.module.css';

interface ISharedDeckListProps {
  readonly cards: readonly ISharedCard[];
  readonly totalCards: number;
  readonly missingCount: number;
  readonly onOpenMissing: () => void;
}

/** Known groups have a translated name; any other slot is shown under its own name. */
function groupLabel(group: ISharedCardGroup, t: (key: string) => string): string {
  return group.id === 'other' ? (group.cards[0]?.slot ?? '') : t(`sharing.list.group.${group.id}`);
}

export function SharedDeckList({
  cards,
  totalCards,
  missingCount,
  onOpenMissing,
}: ISharedDeckListProps): React.ReactElement {
  const { t } = useTranslation();
  const groups = useMemo(() => groupSharedCards(cards), [cards]);

  return (
    <section className={styles.section} aria-labelledby="shared-list-title" data-testid="shared-deck-list">
      <div className={styles.header}>
        <h2 id="shared-list-title" className={styles.title}>
          {t('sharing.list.title')}
          <span className={styles.count}>{t('sharing.page.cardCount', { count: totalCards })}</span>
        </h2>
        <button type="button" className={styles.missingBtn} onClick={onOpenMissing} data-testid="shared-open-missing">
          {t('sharing.list.viewMissing')}
          <span className={styles.missingCount}>{missingCount}</span>
        </button>
      </div>
      <div className={styles.groups}>
        {groups.map((group) => (
          <div key={group.id} className={styles.group} data-testid={`shared-group-${group.id}`}>
            <h3 className={styles.groupTitle}>
              {groupLabel(group, t)}
              <em className={styles.groupTotal}>{group.total}</em>
            </h3>
            <ul className={styles.rows}>
              {group.cards.map((card) => (
                <SharedCardRow key={`${card.cardIdentifier}::${card.slot}`} card={card} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
