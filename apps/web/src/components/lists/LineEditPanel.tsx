import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import {
  CONDITIONS,
  LINE_QUANTITY_MAX,
  LINE_QUANTITY_MIN,
  useApplySuggestionsMutation,
  useListPrintingsQuery,
  usePatchLineMutation,
  useRemoveLineMutation,
  type ICardList,
  type IListLine,
  type IPatchLineBody,
} from '../../api/lists';
import { CardArt } from '../card-art/CardArt';
import { cardName } from '../../lib/card-name';
import { MoneyInput } from './MoneyInput';
import { SuggestionBlock } from './SuggestionBlock';
import { formatBrlWhole } from './listsModel';
import styles from './ListEditor.module.css';

interface ILineEditPanelProps {
  readonly list: ICardList;
  readonly line: IListLine;
  readonly onClose: () => void;
}

export function LineEditPanel({ list, line, onClose }: ILineEditPanelProps): React.ReactElement {
  const { t } = useTranslation();
  const patch = usePatchLineMutation(list.id);
  const remove = useRemoveLineMutation(list.id);
  const applySuggestion = useApplySuggestionsMutation(list.id);
  const isSell = list.kind === 'sell';
  const printings = useListPrintingsQuery(list.id, isSell ? line.cardIdentifier : null);
  const busy = patch.isPending || remove.isPending || applySuggestion.isPending;

  const update = (body: IPatchLineBody): void => patch.mutate({ lineId: line.id, body });
  const printingOptions = printings.data ?? [];
  const hasCurrent = line.printing === null || printingOptions.some((option) => option.printing === line.printing);

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.panelOverlay} />
        <Dialog.Content className={styles.panel} aria-describedby={undefined} data-testid="line-panel">
          <div className={styles.panelHeader}>
            <Dialog.Title className={styles.panelTitle}>{t('lists.panel.title')}</Dialog.Title>
            <Dialog.Close className={styles.iconBtn} aria-label={t('lists.panel.close')}>
              <span aria-hidden="true">&#10005;</span>
            </Dialog.Close>
          </div>
          <div className={styles.panelBody}>
            <div className={styles.panelTop}>
              <div className={styles.panelArt}>
                <CardArt name={line.name} pitch={line.pitch} cost={null} type={line.type} missing={false} size="lg" imageUrl={line.imageUrl} />
              </div>
              <div className={styles.panelTopText}>
                <p className={styles.panelName}>{cardName(line.name, line.pitch, (key) => t(key))}</p>
                <span className={styles.panelLabel} id="line-qty-label">{t('lists.panel.quantity')}</span>
                <div className={styles.stepper} role="group" aria-labelledby="line-qty-label">
                  <button
                    type="button"
                    aria-label={t('lists.panel.decrease')}
                    disabled={busy || line.quantity <= LINE_QUANTITY_MIN}
                    onClick={() => update({ quantity: line.quantity - 1 })}
                  >
                    &minus;
                  </button>
                  <output aria-live="polite">{line.quantity}</output>
                  <button
                    type="button"
                    aria-label={t('lists.panel.increase')}
                    disabled={busy || line.quantity >= LINE_QUANTITY_MAX}
                    onClick={() => update({ quantity: line.quantity + 1 })}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {isSell && (
              <>
                <div>
                  <label className={styles.panelLabel} htmlFor="line-printing">{t('lists.panel.printing')}</label>
                  <select
                    id="line-printing"
                    className={styles.panelField}
                    value={line.printing ?? ''}
                    disabled={busy}
                    onChange={(event) => update({ printing: event.currentTarget.value === '' ? null : event.currentTarget.value })}
                  >
                    <option value="">{t('lists.panel.noPrinting')}</option>
                    {!hasCurrent && line.printing !== null && (
                      <option value={line.printing}>{line.printingLabel ?? line.printing}</option>
                    )}
                    {printingOptions.map((option) => (
                      <option key={option.printing} value={option.printing}>
                        {option.suggestion === null
                          ? t('lists.pricing.printingOptionNone', { label: option.label })
                          : t('lists.pricing.printingOption', { label: option.label, price: formatBrlWhole(option.suggestion.cents) })}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className={styles.panelLabel} id="line-condition-label">{t('lists.panel.condition')}</span>
                  <div className={styles.conditions} role="group" aria-labelledby="line-condition-label">
                    {CONDITIONS.map((condition) => (
                      <button
                        key={condition}
                        type="button"
                        aria-pressed={line.condition === condition}
                        disabled={busy}
                        onClick={() => update({ condition: line.condition === condition ? null : condition })}
                      >
                        {condition}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={styles.panelLabel} htmlFor="line-price">{t('lists.panel.price')}</label>
                  <MoneyInput
                    id="line-price"
                    cents={line.priceCents}
                    placeholder={t('lists.add.price')}
                    invalidMessage={t('lists.panel.priceInvalid')}
                    onCommit={(cents) => update({ priceCents: cents })}
                  />
                  <SuggestionBlock suggestion={line.suggestion} busy={busy} onUse={() => applySuggestion.mutate([line.id])} />
                </div>
              </>
            )}

            {(patch.isError || remove.isError || applySuggestion.isError) && (
              <p className={styles.fieldError} role="alert">{t('lists.editor.saveFailed')}</p>
            )}

            <div className={styles.panelActions}>
              {isSell && (
                <button type="button" className={styles.panelBtn} disabled={busy} onClick={() => update({ sold: !line.sold })}>
                  {line.sold ? t('lists.panel.unmarkSold') : t('lists.panel.markSold')}
                </button>
              )}
              <button
                type="button"
                className={`${styles.panelBtn} ${styles.panelBtnDanger}`}
                disabled={busy}
                onClick={() => remove.mutate(line.id, { onSuccess: onClose })}
              >
                {t('lists.panel.remove')}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
