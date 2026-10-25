import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ISharedCard } from '../../api/shared-decks';
import { SharedGallery } from './SharedGallery';
import { groupSharedCards, type ISharedCardGroup } from './sharedDeckModel';
import { cardName } from '../../lib/card-name';
import styles from './SharedDeckGallery.module.css';

interface ISharedDeckGalleryProps {
  readonly cards: readonly ISharedCard[];
}

/** Known groups have a translated name; any other slot is shown under its own name. */
function groupLabel(group: ISharedCardGroup, t: (key: string) => string): string {
  return group.id === 'other' ? (group.cards[0]?.slot ?? '') : t(`sharing.list.group.${group.id}`);
}

/** The original's name, with its pitch only when the card standing in for it carries the same name. */
function originalName(name: string, original: NonNullable<ISharedCard['replaces']>, t: (key: string) => string): string {
  return original.name === name ? cardName(original.name, original.pitch, t) : original.name;
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
            noteFor={(card) =>
              card.replaces ? (
                <span data-testid="shared-line-replaces">
                  {t('sharing.saveChoice.replacedBy', { name: originalName(card.name, card.replaces, (key) => t(key)) })}
                </span>
              ) : undefined
            }
            formatQuantity={(count) => t('sharing.list.quantity', { count })}
          />
        </div>
      ))}
    </section>
  );
}
