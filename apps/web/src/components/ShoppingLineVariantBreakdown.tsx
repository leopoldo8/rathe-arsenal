import { useTranslation } from 'react-i18next';
import type { IShoppingLineVariant } from '../api/shopping-line';
import { formatBrl } from '../utils/format-brl';
import { isFoilFinish } from './ShoppingLineVariantBreakdown.helpers';
import styles from './ShoppingLineVariantBreakdown.module.css';

interface IVariantBreakdownTableProps {
  readonly variants: readonly IShoppingLineVariant[];
}

export function VariantBreakdownTable({ variants }: IVariantBreakdownTableProps) {
  const { t } = useTranslation();
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th
            scope="col"
            className={`${styles.th} ${styles['th--first']}`}
          >
            {t('decks.variantEditionCol')}
          </th>
          <th
            scope="col"
            className={styles.th}
          >
            {t('decks.variantConditionCol')}
          </th>
          <th
            scope="col"
            className={styles.th}
          >
            {t('decks.variantFinishCol')}
          </th>
          <th
            scope="col"
            className={`${styles.th} ${styles['th--right']}`}
          >
            {t('decks.variantPriceCol')}
          </th>
          <th
            scope="col"
            className={`${styles.th} ${styles['th--right']} ${styles['th--last']}`}
          >
            {t('decks.variantQtyCol')}
          </th>
        </tr>
      </thead>
      <tbody>
        {variants.map((v, idx) => (
          <VariantRow key={`${v.edition}-${v.condition}-${v.finish}-${idx}`} variant={v} />
        ))}
      </tbody>
    </table>
  );
}

interface IVariantRowProps {
  readonly variant: IShoppingLineVariant;
}

function VariantRow({ variant }: IVariantRowProps) {
  const { t } = useTranslation();
  const finishLabel = isFoilFinish(variant.finish) ? variant.finish : t('decks.nonFoil');

  return (
    <tr>
      <td
        className={`${styles.td} ${styles['td--edition']}`}
        title={variant.edition}
      >
        {variant.edition}
      </td>
      <td className={styles.td}>
        {variant.condition}
      </td>
      <td className={styles.td}>
        {finishLabel}
      </td>
      <td className={`${styles.td} ${styles['td--price']}`}>
        {formatBrl(variant.priceCents)}
      </td>
      <td className={`${styles.td} ${styles['td--last']}`}>
        {variant.quantity}
      </td>
    </tr>
  );
}
