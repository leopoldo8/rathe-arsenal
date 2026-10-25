import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { IDeckReplacement } from '../../api/replacements';
import { CardLightbox } from '../card-art/CardLightbox';
import { CardGalleryCell, type ICardGalleryLightbox } from '../card-gallery/CardGalleryCell';
import { CardGalleryGrid } from '../card-gallery/CardGalleryGrid';
import type { ILegalityReasonDetail } from '../../api/decks';
import type { IListCard } from './deckListCards';
import {
  buildTextList,
  groupDeckList,
  resolveTypeGroup,
  type IDeckListItem,
  type TDeckListGroupId,
  type TDeckListView,
} from './deckListModel';
import { ReplacementControls } from './ReplacementMark';
import { DeckTextList } from './DeckTextList';
import { sizeProblemOf } from '../home/deckVerdictLine';
import styles from './DeckList.module.css';

interface IDeckListProps {
  readonly items: readonly IDeckListItem[];
  readonly onEditCards?: (() => void) | undefined;
  /** Needed to undo, keep or revert a replacement; the cells show no controls without it. */
  readonly deckId?: number | undefined;
  readonly replacements?: readonly IDeckReplacement[] | undefined;
  /** The lines the "Lista" view prints as text, with the deck's rule problems to annotate them. */
  readonly listCards?: readonly IListCard[] | undefined;
  readonly legalityDetails?: readonly ILegalityReasonDetail[] | undefined;
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
  deckId,
  replacement,
}: {
  readonly item: IDeckListItem;
  readonly onOpen: (lightbox: ICardGalleryLightbox) => void;
  readonly deckId: number | undefined;
  readonly replacement: IDeckReplacement | undefined;
}): React.ReactElement {
  const { t } = useTranslation();
  const { entry } = item;

  return (
    <CardGalleryCell
      name={entry.name}
      pitch={entry.pitch}
      cost={entry.cost}
      type={entry.type}
      imageUrl={entry.imageUrl}
      missing={item.missing >= item.quantity}
      missingCount={item.missing}
      quantityLabel={t('deckDetail.cardQuantity', { count: item.quantity })}
      quantityTestId="deck-list-qty"
      testId="deck-list-cell"
      dataMissing={item.missing > 0}
      onOpen={onOpen}
      footer={
        replacement !== undefined && deckId !== undefined ? (
          <ReplacementControls deckId={deckId} replacement={replacement} />
        ) : undefined
      }
    />
  );
}

export function DeckList({
  items,
  onEditCards,
  deckId,
  replacements = [],
  listCards,
  legalityDetails = [],
}: IDeckListProps): React.ReactElement {
  const { t } = useTranslation();
  const [view, setView] = useState<TDeckListView>('type');
  const [lightbox, setLightbox] = useState<ICardGalleryLightbox | null>(null);
  const textView = view === 'list' && listCards !== undefined;
  const groups = textView ? [] : groupDeckList(items, view);
  const textGroups = textView ? buildTextList(listCards, legalityDetails, t) : [];
  const deckSize = items
    .filter((item) => resolveTypeGroup(item.entry) !== 'loadout')
    .reduce((sum, item) => sum + item.quantity, 0);

  const shortOf = sizeProblemOf(legalityDetails);
  const countText =
    shortOf === null
      ? t('deckDetail.decklistCount', { count: deckSize })
      : deckSize < shortOf.limit
        ? t('deckDetail.editorDeckSizeShort', { count: deckSize, target: shortOf.limit, missing: shortOf.limit - deckSize })
        : t('deckDetail.decklistCount', { count: deckSize });

  return (
    <section className={styles.section} aria-labelledby="deck-list-title" data-testid="deck-list">
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h2 id="deck-list-title" className={styles.title}>
            {t('deckDetail.decklistTitle')}
          </h2>
          <span className={styles.count} data-testid="deck-list-count">
            {countText}
          </span>
        </div>
        <div className={styles.headerActions}>
          {onEditCards !== undefined && (
            <button
              type="button"
              className={styles.editCardsBtn}
              aria-label={t('deckDetail.editCardsAria')}
              data-testid="deck-list-edit-cards-btn"
              onClick={onEditCards}
            >
              {t('deckDetail.editCards')}
            </button>
          )}
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
      </div>

      {textView && <DeckTextList groups={textGroups} />}
      {!textView && groups.length === 0 && <p className={styles.empty}>{t('deckDetail.decklistEmpty')}</p>}
      {groups.map((group) => (
        <div key={group.id} className={styles.group} data-testid={`deck-list-group-${group.id}`}>
          <h3 className={styles.groupTitle}>
            {t(GROUP_LABEL_KEY[group.id])}
            <span className={styles.groupCount}>{t('deckDetail.groupCount', { count: group.total })}</span>
          </h3>
          <CardGalleryGrid>
            {group.items.map((item) => (
              <DeckListCell
                key={item.key}
                item={item}
                onOpen={setLightbox}
                deckId={deckId}
                replacement={replacements.find(
                  (candidate) =>
                    candidate.replacementCardIdentifier === item.entry.cardIdentifier &&
                    candidate.slot === item.entry.slot,
                )}
              />
            ))}
          </CardGalleryGrid>
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
