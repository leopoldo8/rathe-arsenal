import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CardArt } from '../card-art/CardArt';
import { CardLightbox } from '../card-art/CardLightbox';
import { lightboxSourcesFor } from '../card-art/use-lightbox-sources';
import {
  groupDeckList,
  type IDeckListItem,
  type TDeckListGroupId,
  type TDeckListView,
} from './deckListModel';
import styles from './DeckList.module.css';

interface IDeckListProps {
  readonly items: readonly IDeckListItem[];
}

interface ILightboxState {
  readonly imageUrl: string;
  readonly sources: readonly string[];
  readonly name: string;
}

const VIEWS: readonly { readonly id: TDeckListView; readonly labelKey: string }[] = [
  { id: 'type', labelKey: 'deckDetail.viewByType' },
  { id: 'cost', labelKey: 'deckDetail.viewByCost' },
  { id: 'list', labelKey: 'deckDetail.viewList' },
];

const GROUP_LABEL_KEY: Readonly<Record<TDeckListGroupId, string>> = {
  attack: 'deckDetail.groupAttack',
  defense: 'deckDetail.groupDefense',
  nonAttack: 'deckDetail.groupNonAttack',
  loadout: 'deckDetail.groupLoadout',
  all: 'deckDetail.groupAll',
  '0': 'deckDetail.groupCost0',
  '1': 'deckDetail.groupCost1',
  '2': 'deckDetail.groupCost2',
  '3': 'deckDetail.groupCost3',
  '4plus': 'deckDetail.groupCost4plus',
  none: 'deckDetail.groupCostNone',
};

function DeckListCell({
  item,
  onOpen,
}: {
  readonly item: IDeckListItem;
  readonly onOpen: (lightbox: ILightboxState) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const { entry } = item;
  const isShort = item.missing > 0;
  const cellClass = [styles.cell, isShort ? styles.cellMissing : ''].filter(Boolean).join(' ');
  const image = entry.imageUrl;

  return (
    <li className={cellClass} data-testid="deck-list-cell" data-missing={isShort}>
      <div className={styles.thumb}>
        <CardArt
          name={entry.name}
          pitch={entry.pitch}
          cost={entry.cost}
          type={entry.type}
          missing={item.missing >= item.quantity}
          missingCount={item.missing}
          size="lg"
          imageUrl={image}
          onClick={
            image
              ? () =>
                  onOpen({
                    imageUrl: image.large,
                    sources: lightboxSourcesFor(image),
                    name: entry.name,
                  })
              : undefined
          }
        />
        <span className={styles.qtyBadge} data-testid="deck-list-qty">
          {t('deckDetail.cardQuantity', { count: item.quantity })}
        </span>
      </div>
      <span className={styles.name} title={entry.name}>
        {entry.name}
      </span>
    </li>
  );
}

export function DeckList({ items }: IDeckListProps): React.ReactElement {
  const { t } = useTranslation();
  const [view, setView] = useState<TDeckListView>('type');
  const [lightbox, setLightbox] = useState<ILightboxState | null>(null);
  const groups = groupDeckList(items, view);

  return (
    <section className={styles.section} aria-labelledby="deck-list-title" data-testid="deck-list">
      <div className={styles.header}>
        <h2 id="deck-list-title" className={styles.title}>
          {t('deckDetail.decklistTitle')}
        </h2>
        <div className={styles.toggle} role="group" aria-label={t('deckDetail.viewToggleAria')}>
          {VIEWS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={[styles.toggleBtn, view === option.id ? styles.toggleBtnActive : '']
                .filter(Boolean)
                .join(' ')}
              aria-pressed={view === option.id}
              data-testid={`deck-list-view-${option.id}`}
              onClick={() => setView(option.id)}
            >
              {t(option.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {groups.length === 0 && <p className={styles.empty}>{t('deckDetail.decklistEmpty')}</p>}
      {groups.map((group) => (
        <div key={group.id} className={styles.group} data-testid={`deck-list-group-${group.id}`}>
          <h3 className={styles.groupTitle}>
            {t(GROUP_LABEL_KEY[group.id])}
            <span className={styles.groupCount}>{t('deckDetail.groupCount', { count: group.total })}</span>
          </h3>
          <ul className={styles.grid}>
            {group.items.map((item) => (
              <DeckListCell key={item.key} item={item} onOpen={setLightbox} />
            ))}
          </ul>
        </div>
      ))}

      {lightbox && (
        <CardLightbox
          imageUrl={lightbox.imageUrl}
          sources={lightbox.sources}
          name={lightbox.name}
          onClose={() => setLightbox(null)}
        />
      )}
    </section>
  );
}
