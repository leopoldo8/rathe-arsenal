import { useState, useId } from 'react';
import { useTranslation } from 'react-i18next';
import * as Dialog from '@radix-ui/react-dialog';
import { ShoppingLine, TVariantFetchMutationStatus } from '../ShoppingLine';
import { IShoppingLineResponse } from '../../api/shopping-line';
import { formatBrl } from '../../utils/format-brl';
import styles from './ShoppingPanel.module.css';

interface IShoppingPanelProps {
  /**
   * Shopping line data from the API response. null = Path A (no missing cards).
   */
  readonly data: IShoppingLineResponse | null;
  readonly onFetchVariants?: () => void;
  readonly fetchMutationStatus?: TVariantFetchMutationStatus;
  readonly isCooldownActive?: boolean;
  readonly onPollingChange?: (startedAt: number | undefined) => void;
  /**
   * Called when the user clicks "Retry" in the ShoppingLine error state.
   * The host route owns recovery (TanStack Query invalidation / refetch).
   */
  readonly onRetry?: () => void;
}

/**
 * ShoppingPanel — Column C of deck detail (R24, R57).
 *
 * Desktop (≥ 960px): renders as a sticky <aside> column.
 * Mobile (< 960px): shopping panel is replaced by a sticky bottom bar
 *   showing "View shopping list · R$ X". Tapping the bar opens a Radix
 *   Dialog bottom sheet (height: 92vh, slide-up animation). Dismissed via
 *   X button, backdrop tap, or Escape.
 *
 * Both desktop column and mobile sheet render the same ShoppingLine content
 * component — no data-flow difference between breakpoints.
 *
 * <aside> landmark satisfies R57.
 */
export function ShoppingPanel({
  data,
  onFetchVariants,
  fetchMutationStatus = 'idle',
  isCooldownActive = false,
  onPollingChange,
  onRetry,
}: IShoppingPanelProps): React.ReactElement {
  const { t } = useTranslation();
  const [sheetOpen, setSheetOpen] = useState(false);
  const titleId = useId();

  // Extract total cost for the mobile sticky bar label
  const totalCostCents =
    data && data.kind === 'populated' ? data.totalCostCents : null;

  const mobileLabelPrice =
    totalCostCents !== null ? ` · ${formatBrl(totalCostCents)}` : '';

  const panelContent = (
    <ShoppingLine
      data={data}
      {...(onFetchVariants !== undefined ? { onFetchVariants } : {})}
      fetchMutationStatus={fetchMutationStatus}
      isCooldownActive={isCooldownActive}
      {...(onPollingChange !== undefined ? { onPollingChange } : {})}
      {...(onRetry !== undefined ? { onRetry } : {})}
    />
  );

  return (
    <>
      {/* Desktop: sticky aside column — hidden on mobile via CSS */}
      <aside
        className={styles.panel}
        aria-label={t('decks.shoppingList')}
        data-testid="shopping-panel-desktop"
      >
        <div className={styles.panel__inner}>{panelContent}</div>
      </aside>

      {/* Mobile: sticky bottom bar + Radix Dialog bottom sheet */}
      <div className={styles.mobileBar} data-testid="shopping-panel-mobile-bar">
        <button
          type="button"
          className={styles.mobileBar__btn}
          onClick={() => setSheetOpen(true)}
          aria-label={t('decks.viewShoppingList')}
        >
          <span>{t('decks.viewShoppingListWithPrice', { price: mobileLabelPrice })}</span>
          <span className={styles.mobileBar__arrow} aria-hidden="true">&#8679;</span>
        </button>
      </div>

      {/* Mobile bottom sheet — Radix Dialog */}
      <Dialog.Root open={sheetOpen} onOpenChange={setSheetOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.sheet__overlay} />
          <Dialog.Content
            className={styles.sheet}
            aria-labelledby={titleId}
            aria-describedby={undefined}
            data-testid="shopping-panel-sheet"
          >
            <div className={styles.sheet__header}>
              <Dialog.Title id={titleId} className={styles.sheet__title}>
                {t('decks.shoppingList')}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button
                  type="button"
                  className={styles.sheet__close}
                  aria-label={t('decks.closeShoppingList')}
                >
                  <span aria-hidden="true">&#10005;</span>
                </button>
              </Dialog.Close>
            </div>
            <div className={styles.sheet__body}>{panelContent}</div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
