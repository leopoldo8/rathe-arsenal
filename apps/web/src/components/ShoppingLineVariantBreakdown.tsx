import type { IShoppingLineVariant } from '../api/shopping-line';
import { formatBrl } from '../utils/format-brl';
import { isFoilFinish } from './ShoppingLineVariantBreakdown.helpers';
import styles from './ShoppingLineVariantBreakdown.module.css';

interface IVariantBreakdownTableProps {
  readonly variants: readonly IShoppingLineVariant[];
}

export function VariantBreakdownTable({ variants }: IVariantBreakdownTableProps) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th
            scope="col"
            className={`${styles.th} ${styles['th--first']}`}
          >
            Edition
          </th>
          <th
            scope="col"
            className={styles.th}
          >
            Condition
          </th>
          <th
            scope="col"
            className={styles.th}
          >
            Finish
          </th>
          <th
            scope="col"
            className={`${styles.th} ${styles['th--right']}`}
          >
            Price
          </th>
          <th
            scope="col"
            className={`${styles.th} ${styles['th--right']} ${styles['th--last']}`}
          >
            Qty
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
  const finishLabel = isFoilFinish(variant.finish) ? variant.finish : 'Non-foil';

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
