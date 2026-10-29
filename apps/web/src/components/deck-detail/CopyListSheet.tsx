import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import type { IDeckLegality } from '../../api/decks';
import { useToast } from '../ui/Toast/useToast';
import type { IListCard } from './deckListCards';
import { buildFabraryText, buildGroupText, buildRuleWarning } from './deckListText';
import styles from './CopyListSheet.module.css';

type TCopyTarget = 'group' | 'fabrary';

interface ICopyListSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly deckName: string;
  readonly format: string;
  readonly cards: readonly IListCard[];
  /** The deck's verdict; absent where the visitor has none (a shared deck). */
  readonly legality?: IDeckLegality | null | undefined;
}

const TABS: readonly { readonly id: TCopyTarget; readonly labelKey: string }[] = [
  { id: 'group', labelKey: 'deckDetail.copyTabGroup' },
  { id: 'fabrary', labelKey: 'deckDetail.copyTabFabrary' },
];

/**
 * The sheet behind "Copiar lista": two destinations, none chosen at first, and the whole text on screen
 * before "Copiar" can be pressed. A rule problem is a warning above the preview and never blocks copying.
 */
export function CopyListSheet(props: ICopyListSheetProps): React.ReactElement | null {
  // Mounted only while open: the choice starts empty each time, and a page that never opens it needs no toast provider.
  return props.open ? <OpenCopyListSheet {...props} /> : null;
}

function OpenCopyListSheet({
  open,
  onOpenChange,
  deckName,
  format,
  cards,
  legality = null,
}: ICopyListSheetProps): React.ReactElement {
  const { t } = useTranslation();
  const { show: showToast } = useToast();
  const [target, setTarget] = React.useState<TCopyTarget | null>(null);

  const input = { deckName, format, cards };
  const text = target === null ? null : target === 'group' ? buildGroupText(input, t) : buildFabraryText(input);
  const warning = buildRuleWarning(legality, cards, format, t);
  const hasInventory = cards.some((card) => card.inventoryQuantity > 0);

  async function handleCopy(): Promise<void> {
    if (text === null) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      showToast({ kind: 'error', message: t('deckDetail.copyFailed') });
      return;
    }
    onOpenChange(false);
    showToast({ kind: 'success', message: t('deckDetail.copyDone') });
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.panel} aria-describedby={undefined} data-testid="copy-list-sheet">
          <div className={styles.head}>
            <Dialog.Title className={styles.title}>{t('deckDetail.copySheetTitle')}</Dialog.Title>
            <Dialog.Close className={styles.close}>{t('deckDetail.copyClose')}</Dialog.Close>
          </div>
          <div className={styles.tabs} role="tablist" aria-label={t('deckDetail.copyTabsAria')}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`copy-tab-${tab.id}`}
                aria-selected={target === tab.id}
                aria-controls="copy-list-panel"
                className={styles.tab}
                data-selected={target === tab.id}
                onClick={() => setTarget(tab.id)}
              >
                {t(tab.labelKey)}
              </button>
            ))}
          </div>
          <div className={styles.body}>
            {warning !== null && (
              <p className={styles.warning} data-testid="copy-list-warning">
                {warning}
              </p>
            )}
            {text !== null && (
              <div id="copy-list-panel" role="tabpanel" aria-labelledby={`copy-tab-${target}`}>
                {hasInventory && <p className={styles.plain}>{t('deckDetail.inventoryPlain')}</p>}
                <pre className={styles.preview} tabIndex={0} aria-label={t('deckDetail.copyPreviewAria')} data-testid="copy-list-preview">
                  {text}
                </pre>
              </div>
            )}
          </div>
          <button type="button" className={styles.copy} disabled={text === null} onClick={() => void handleCopy()}>
            {t('deckDetail.copyAction')}
          </button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
