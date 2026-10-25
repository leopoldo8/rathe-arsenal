import React, { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useTranslation } from 'react-i18next';
import {
  CONDITIONS,
  LINE_QUANTITY_MAX,
  LINE_QUANTITY_MIN,
  useAddLineMutation,
  useListPrintingsQuery,
  type ICardList,
  type TCondition,
} from '../../api/lists';
import { useSearchCardsQuery, type ISearchCardResult } from '../../api/catalog';
import { CardArt } from '../card-art/CardArt';
import { cardName } from '../../lib/card-name';
import { MoneyInput } from './MoneyInput';
import { formatBrlWhole } from './listsModel';
import dialog from './ListDialog.module.css';
import styles from './AddCardDialog.module.css';

const SEARCH_DEBOUNCE_MS = 250;
const MIN_QUERY = 2;

function toPitch(pitch: number | null): 1 | 2 | 3 | null {
  return pitch === 1 || pitch === 2 || pitch === 3 ? pitch : null;
}

interface IAddCardDialogProps {
  readonly list: ICardList;
  readonly onClose: () => void;
}

export function AddCardDialog({ list, onClose }: IAddCardDialogProps): React.ReactElement {
  const { t } = useTranslation();
  const isSell = list.kind === 'sell';
  const add = useAddLineMutation(list.id);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [picked, setPicked] = useState<ISearchCardResult | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [printing, setPrinting] = useState('');
  const [condition, setCondition] = useState<TCondition | ''>('');
  const [priceCents, setPriceCents] = useState<number | null>(null);
  const [addedName, setAddedName] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const search = useSearchCardsQuery(debounced);
  const printings = useListPrintingsQuery(list.id, isSell && picked !== null ? picked.cardIdentifier : null);
  const results = search.data?.results ?? [];
  const showResults = debounced.length >= MIN_QUERY;
  const noResults = showResults && search.isSuccess && !search.isFetching && results.length === 0;

  function pick(card: ISearchCardResult): void {
    setPicked(card);
    setQuantity(1);
    setPrinting('');
    setCondition('');
    setPriceCents(null);
    setAddedName(null);
  }

  function submit(): void {
    if (picked === null) return;
    const chosenPrinting = printing === '' ? undefined : printings.data?.find((option) => option.printing === printing);
    const name = cardName(picked.name, picked.pitch, (key) => t(key));
    add.mutate(
      {
        cardIdentifier: picked.cardIdentifier,
        quantity,
        ...(isSell
          ? {
              ...(chosenPrinting === undefined ? {} : { printingCode: chosenPrinting.printingCode, edition: chosenPrinting.edition, finish: chosenPrinting.finish }),
              ...(condition !== '' ? { condition } : {}),
              ...(priceCents !== null ? { priceCents } : {}),
            }
          : {}),
      },
      {
        onSuccess: () => {
          setAddedName(name);
          setPicked(null);
        },
      },
    );
  }

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={dialog.overlay} />
        <Dialog.Content className={`${dialog.panel} ${dialog.panelWide}`} aria-describedby={undefined} data-testid="add-card-dialog">
          <div className={dialog.header}>
            <Dialog.Title className={dialog.title}>{t('lists.add.title')}</Dialog.Title>
            <Dialog.Close className={dialog.iconBtn} aria-label={t('lists.add.close')}>
              <span aria-hidden="true">&#10005;</span>
            </Dialog.Close>
          </div>
          <div className={dialog.body}>
            <div>
              <label className={dialog.label} htmlFor="add-card-search">{t('lists.add.searchLabel')}</label>
              <input
                id="add-card-search"
                className={dialog.field}
                type="search"
                autoComplete="off"
                spellCheck={false}
                autoFocus
                placeholder={t('lists.add.searchPlaceholder')}
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
              />
            </div>

            {!showResults && <p className={dialog.status}>{t('lists.add.typeHint')}</p>}
            {noResults && <p className={dialog.status}>{t('lists.add.noResults', { query: debounced })}</p>}

            {showResults && results.length > 0 && (
              <ul className={styles.results} aria-label={t('lists.add.searchLabel')}>
                {results.map((card) => (
                  <li key={card.cardIdentifier}>
                    <button
                      type="button"
                      className={styles.result}
                      data-selected={picked?.cardIdentifier === card.cardIdentifier || undefined}
                      aria-label={t('lists.add.pick', { name: cardName(card.name, card.pitch, (key) => t(key)) })}
                      onClick={() => pick(card)}
                    >
                      <span className={styles.resultArt}>
                        <CardArt name={card.name} pitch={toPitch(card.pitch)} cost={null} type={card.types[0] ?? ''} missing={false} size="lg" imageUrl={card.imageUrl} />
                      </span>
                      <span className={styles.resultName}>{cardName(card.name, card.pitch, (key) => t(key))}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {addedName !== null && picked === null && (
              <p className={dialog.status} role="status">{t('lists.add.added', { name: addedName })}</p>
            )}
            {add.isError && <p className={dialog.error} role="alert">{t('lists.add.failed')}</p>}
          </div>

          {picked !== null && (
            <div className={styles.picked} data-testid="add-card-picked">
              <div className={styles.pickedHead}>
                <span className={styles.pickedName}>{cardName(picked.name, picked.pitch, (key) => t(key))}</span>
                <span className={styles.pickedOwned}>{t('lists.add.inCollection', { count: picked.ownedQuantity })}</span>
              </div>
              <div className={styles.pickedFields}>
                <div className={styles.stepper} role="group" aria-label={t('lists.panel.quantity')}>
                  <button type="button" aria-label={t('lists.panel.decrease')} disabled={quantity <= LINE_QUANTITY_MIN} onClick={() => setQuantity(quantity - 1)}>&minus;</button>
                  <output aria-live="polite">{quantity}</output>
                  <button type="button" aria-label={t('lists.panel.increase')} disabled={quantity >= LINE_QUANTITY_MAX} onClick={() => setQuantity(quantity + 1)}>+</button>
                </div>
                {isSell && (
                  <>
                    <select className={styles.smallSelect} aria-label={t('lists.add.printing')} value={printing} onChange={(event) => setPrinting(event.currentTarget.value)}>
                      <option value="">{t('lists.add.printing')}</option>
                      {(printings.data ?? []).map((option) => (
                        <option key={option.printing} value={option.printing}>
                          {option.suggestion === null
                            ? option.label
                            : t('lists.pricing.printingOption', { label: option.label, price: formatBrlWhole(option.suggestion.cents) })}
                        </option>
                      ))}
                    </select>
                    <select className={styles.smallSelect} aria-label={t('lists.add.condition')} value={condition} onChange={(event) => setCondition(event.currentTarget.value as TCondition | '')}>
                      <option value="">{t('lists.add.condition')}</option>
                      {CONDITIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                    <div className={styles.priceBox}>
                      <MoneyInput id="add-card-price" cents={priceCents} placeholder={t('lists.add.price')} invalidMessage={t('lists.panel.priceInvalid')} onCommit={setPriceCents} />
                    </div>
                  </>
                )}
                <button type="button" className={styles.submit} disabled={add.isPending} onClick={submit}>
                  {t('lists.add.submit')}
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
