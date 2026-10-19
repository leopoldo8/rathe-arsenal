import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ISharedCard } from '../../api/shared-decks';
import { SharedGallery } from './SharedGallery';
import { groupSharedCards, type ISharedCardGroup } from './sharedDeckModel';
import styles from './SharedDeckGallery.module.css';

interface ISharedDeckGalleryProps {
  readonly cards: readonly ISharedCard[];
}

/** Known groups have a translated name; any other slot is shown under its own name. */
function groupLabel(group: ISharedCardGroup, t: (key: string) => string): string {
  return group.id === 'other' ? (group.cards[0]?.slot ?? '') : t(`sharing.list.group.${group.id}`);
}

/** The shared deck: every card as a large image, grouped by type. */
export function SharedDeckGallery({ cards }: ISharedDeckGalleryProps): React.ReactElement {
  const { t } = useTranslation();
  const groups = useMemo(() => groupSharedCards(cards), [cards]);

  return (
    <section className={styles.section} aria-label={t('sharing.page.eyebrow')} data-testid="shared-deck-list">
      {groups.map((group) => (
        <div key={group.id} className={styles.group} data-testid={`shared-group-${group.id}`}>
          <h2 className={styles.groupTitle}>
            {groupLabel(group, t)}
            <em className={styles.groupTotal}>{t('sharing.list.groupCount', { count: group.total })}</em>
          </h2>
          <SharedGallery
            cards={group.cards}
            countAs="quantity"
            formatQuantity={(count) => t('sharing.list.quantity', { count })}
          />
        </div>
      ))}
    </section>
  );
}
