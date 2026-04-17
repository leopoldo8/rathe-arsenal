import { IShoppingLineVariant } from '../api/shopping-line';
import { formatBrl } from '../utils/format-brl';

/**
 * Returns true when the finish string represents a foil finish.
 * 'Non-foil' is the only non-foil value; everything else is foil.
 */
export function isFoilFinish(finish: string): boolean {
  return finish.toLowerCase() !== 'non-foil';
}

/**
 * Formats a variant's price with condition annotation and optional foil suffix.
 * Example: "R$ 0,35 (NM)" or "R$ 0,80 (NM, Foil)"
 */
export function formatVariantPrice(variant: IShoppingLineVariant): string {
  const price = formatBrl(variant.priceCents);
  const foilSuffix = isFoilFinish(variant.finish) ? ', Foil' : '';
  return `${price} (${variant.condition}${foilSuffix})`;
}

interface IVariantBreakdownTableProps {
  readonly variants: readonly IShoppingLineVariant[];
}

export function VariantBreakdownTable({ variants }: IVariantBreakdownTableProps) {
  return (
    <table
      style={{
        marginTop: '0.375rem',
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '0.75rem',
        color: '#4a5568',
      }}
    >
      <thead>
        <tr>
          <th
            scope="col"
            style={{
              textAlign: 'left',
              fontWeight: 600,
              padding: '0.25rem 0.375rem 0.25rem 0',
              borderBottom: '1px solid #edf2f7',
              whiteSpace: 'nowrap',
            }}
          >
            Edition
          </th>
          <th
            scope="col"
            style={{
              textAlign: 'left',
              fontWeight: 600,
              padding: '0.25rem 0.375rem',
              borderBottom: '1px solid #edf2f7',
              whiteSpace: 'nowrap',
            }}
          >
            Condition
          </th>
          <th
            scope="col"
            style={{
              textAlign: 'left',
              fontWeight: 600,
              padding: '0.25rem 0.375rem',
              borderBottom: '1px solid #edf2f7',
              whiteSpace: 'nowrap',
            }}
          >
            Finish
          </th>
          <th
            scope="col"
            style={{
              textAlign: 'right',
              fontWeight: 600,
              padding: '0.25rem 0.375rem',
              borderBottom: '1px solid #edf2f7',
              whiteSpace: 'nowrap',
            }}
          >
            Price
          </th>
          <th
            scope="col"
            style={{
              textAlign: 'right',
              fontWeight: 600,
              padding: '0.25rem 0 0.25rem 0.375rem',
              borderBottom: '1px solid #edf2f7',
              whiteSpace: 'nowrap',
            }}
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
        style={{
          padding: '0.25rem 0.375rem 0.25rem 0',
          borderBottom: '1px solid #f7fafc',
          maxWidth: '12rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
        title={variant.edition}
      >
        {variant.edition}
      </td>
      <td
        style={{
          padding: '0.25rem 0.375rem',
          borderBottom: '1px solid #f7fafc',
          whiteSpace: 'nowrap',
        }}
      >
        {variant.condition}
      </td>
      <td
        style={{
          padding: '0.25rem 0.375rem',
          borderBottom: '1px solid #f7fafc',
          whiteSpace: 'nowrap',
        }}
      >
        {finishLabel}
      </td>
      <td
        style={{
          padding: '0.25rem 0.375rem',
          borderBottom: '1px solid #f7fafc',
          textAlign: 'right',
          whiteSpace: 'nowrap',
          fontWeight: 500,
        }}
      >
        {formatBrl(variant.priceCents)}
      </td>
      <td
        style={{
          padding: '0.25rem 0 0.25rem 0.375rem',
          borderBottom: '1px solid #f7fafc',
          textAlign: 'right',
          whiteSpace: 'nowrap',
        }}
      >
        {variant.quantity}
      </td>
    </tr>
  );
}
