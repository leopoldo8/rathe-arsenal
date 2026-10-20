import React from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { IListSummary } from '../../api/lists';
import { CARD_BACK_SRC } from '../deck-detail/recommendations/card-naming';
import { formatBrl, listMeta, makeTranslate } from './listsModel';
import styles from './ListsIndex.module.css';

const PREVIEW_COUNT = 3;

export function ListCard({ list }: { readonly list: IListSummary }): React.ReactElement {
  const { t } = useTranslation();
  const previews = list.previewImages.slice(0, PREVIEW_COUNT);
  return (
    <li>
      <Link to="/lists/$listId" params={{ listId: String(list.id) }} className={styles.card} data-testid="list-card">
        <span className={styles.fan} aria-hidden="true">
          {previews.length === 0 ? (
            <img className={styles.fanImg} src={CARD_BACK_SRC} alt="" />
          ) : (
            previews.map((image, index) => <img key={`${image.small}-${index}`} className={styles.fanImg} src={image.small} alt="" loading="lazy" />)
          )}
        </span>
        <span className={styles.cardText}>
          <span className={styles.cardName}>{list.name}</span>
          <span className={styles.cardMeta}>{listMeta(list, makeTranslate(t))}</span>
          {list.shared && (
            <span className={styles.sharedBadge} data-testid="list-shared-badge">
              {t('lists.sharedBadge')}
            </span>
          )}
          {list.kind === 'sell' && list.totalPriceCents !== null && (
            <span className={styles.cardTotal}>{t('lists.allFor', { price: formatBrl(list.totalPriceCents) })}</span>
          )}
        </span>
      </Link>
    </li>
  );
}
