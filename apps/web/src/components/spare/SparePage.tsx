import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { LINE_QUANTITY_MAX } from '../../api/lists';
import { usePatchDeckMutation } from '../../api/decks';
import { SPARE_QUERY_KEY, useSpareQuery, type IIdeaDeck, type ISpareResponse, type ISpareRow } from '../../api/spare';
import { cardName } from '../../lib/card-name';
import { ligaFabUrl } from '../../lib/ligafab-link';
import { formatBrl } from '../../utils/format-brl';
import { Skeleton } from '../ui/Skeleton/Skeleton';
import { useToast } from '../ui/Toast/useToast';
import { SellDraft } from './SellDraft';
import {
  chosenTotals,
  filterRows,
  plural,
  PRICE_FILTERS,
  ruleLine,
  rowKey,
  sortRows,
  suggestedReais,
  versionText,
  type TPriceFilter,
  type TSort,
} from './spareModel';
import { SpareRuleSheet } from './SpareRuleSheet';
import { WhySpareSheet } from './WhySpareSheet';
import styles from './SparePage.module.css';

interface ISparePageProps {
  /** Back to the collection. */
  readonly onBack: () => void;
  /** Called with the id of the sell list a draft just created. */
  readonly onSent: (listId: number) => void;
}

type TView =
  | { readonly kind: 'list' }
  | { readonly kind: 'rule' }
  | { readonly kind: 'why'; readonly row: ISpareRow }
  | { readonly kind: 'draft' };

type TTranslate = ReturnType<typeof useTranslation>['t'];

const SORTS: ReadonlyArray<{ readonly sort: TSort; readonly labelKey: string }> = [
  { sort: 'price', labelKey: 'spare.sortPrice' },
  { sort: 'name', labelKey: 'spare.sortName' },
];
const FILTER_LABEL_KEY: Readonly<Record<string, string>> = {
  all: 'spare.showAll',
  '5': 'spare.showAbove5',
  '20': 'spare.showAbove20',
};

function maxToSell(row: ISpareRow): number {
  return Math.min(row.spare, LINE_QUANTITY_MAX);
}

interface IChipsProps<T extends string | number> {
  readonly label: string;
  readonly options: ReadonlyArray<{ readonly value: T; readonly text: string }>;
  readonly value: T;
  readonly onChange: (value: T) => void;
}

function Chips<T extends string | number>({ label, options, value, onChange }: IChipsProps<T>): React.ReactElement {
  return (
    <div className={styles.chipRow} role="group" aria-label={label}>
      <span className={styles.chipLabel} aria-hidden="true">
        {label}
      </span>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={option.value === value ? `${styles.chip} ${styles.chipOn}` : styles.chip}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.text}
        </button>
      ))}
    </div>
  );
}

function IdeaNotice({ deck }: { readonly deck: IIdeaDeck }): React.ReactElement {
  const { t } = useTranslation();
  const { show } = useToast();
  const queryClient = useQueryClient();
  const patch = usePatchDeckMutation(deck.deckId);
  return (
    <div className={styles.notice} data-testid="idea-notice">
      <p className={styles.noticeText}>{t('spare.ideaNotice', { deck: deck.deckName, count: deck.use, card: deck.name })}</p>
      <button
        type="button"
        className={styles.noticeButton}
        disabled={patch.isPending}
        onClick={() =>
          patch.mutate(
            { status: 'building' },
            {
              onSuccess: () => void queryClient.invalidateQueries({ queryKey: SPARE_QUERY_KEY }),
              onError: () => show({ kind: 'error', message: t('spare.markBuildingFailed') }),
            },
          )
        }
      >
        {t('spare.markBuilding', { deck: deck.deckName })}
      </button>
    </div>
  );
}

interface ISpareRowItemProps {
  readonly row: ISpareRow;
  readonly rows: readonly ISpareRow[];
  readonly quantity: number;
  readonly onQuantity: (quantity: number) => void;
  readonly onWhy: (row: ISpareRow) => void;
  readonly t: TTranslate;
}

function SpareRowItem({ row, rows, quantity, onQuantity, onWhy, t }: ISpareRowItemProps): React.ReactElement {
  const name = cardName(row.name, row.pitch, (key) => t(key));
  const version = versionText(row, rows, t);
  const suggested = suggestedReais(row);
  const max = maxToSell(row);
  const showStore = (row.finish === '' || row.finish === 'none') && row.storeCents !== null;
  return (
    <li className={styles.row} data-testid="spare-row">
      {row.imageUrl !== null && <img className={styles.art} src={row.imageUrl} alt="" loading="lazy" />}
      <div className={styles.rowText}>
        <p className={styles.name}>{name}</p>
        <p className={styles.meta}>{version === null ? t('spare.sparePlain', { count: row.spare }) : t('spare.versionLine', { version, count: row.spare })}</p>
        {suggested !== null && <p className={styles.meta}>{t('spare.suggested', { price: suggested })}</p>}
        {showStore && row.storeCents !== null && <p className={styles.meta}>{t('spare.storeReference', { price: formatBrl(row.storeCents) })}</p>}
        <button type="button" className={styles.link} onClick={() => onWhy(row)}>
          {t('spare.whySpare')}
        </button>
        <a className={styles.link} href={ligaFabUrl(row.name)} target="_blank" rel="noopener noreferrer">
          {t('spare.ligaFab')}
          <span className={styles.srOnly}> {name}</span>
          <span aria-hidden="true"> ↗</span>
        </a>
      </div>
      <div className={styles.stepper} role="group" aria-label={t('spare.stepperAria', { name })}>
        <button type="button" className={styles.stepButton} aria-label={t('spare.less', { name })} disabled={quantity <= 0} onClick={() => onQuantity(quantity - 1)}>
          &minus;
        </button>
        <output className={styles.quantity} aria-live="polite">
          {quantity}
        </output>
        <button type="button" className={styles.stepButton} aria-label={t('spare.more', { name })} disabled={quantity >= max} onClick={() => onQuantity(quantity + 1)}>
          +
        </button>
      </div>
    </li>
  );
}

function ruleRow(spare: ISpareResponse, onChange: () => void, t: TTranslate): React.ReactElement | null {
  if (spare.rule === null) return null;
  return (
    <div className={styles.ruleBox}>
      <p className={styles.ruleText}>{ruleLine(spare.rule, t)}</p>
      <button type="button" className={styles.change} onClick={onChange}>
        {t('spare.change')}
      </button>
    </div>
  );
}

/** "Sobrando": every spare copy by version under the player's rule, and the choice of what to sell. */
export function SparePage({ onBack, onSent }: ISparePageProps): React.ReactElement {
  const { t } = useTranslation();
  const query = useSpareQuery();
  const [view, setView] = useState<TView>({ kind: 'list' });
  const [sort, setSort] = useState<TSort>('price');
  const [filter, setFilter] = useState<TPriceFilter>('all');
  const [chosen, setChosen] = useState<Readonly<Record<string, number>>>({});
  const spare = query.data;
  const visible = useMemo(() => (spare === undefined ? [] : sortRows(filterRows(spare.rows, filter), sort)), [spare, filter, sort]);
  const sortedAll = useMemo(() => (spare === undefined ? [] : sortRows(spare.rows, sort)), [spare, sort]);

  if (query.isLoading) {
    return (
      <div className={styles.page} role="status" aria-label={t('spare.loading')}>
        <Skeleton height="320px" />
      </div>
    );
  }
  if (query.isError || spare === undefined) {
    return (
      <div className={styles.page}>
        <p role="alert" className={styles.error}>
          {t('spare.loadError')}
        </p>
        <button type="button" className={styles.link} onClick={() => void query.refetch()}>
          {t('spare.retry')}
        </button>
      </div>
    );
  }

  if (spare.needsRule) {
    return <SpareRuleSheet counts={spare.counts} initialRule={null} backLabel={t('spare.backToCollection')} onBack={onBack} />;
  }
  if (view.kind === 'rule') {
    return (
      <SpareRuleSheet
        counts={spare.counts}
        initialRule={spare.rule}
        backLabel={t('spare.backToSpare')}
        onBack={() => setView({ kind: 'list' })}
        onSaved={() => setView({ kind: 'list' })}
      />
    );
  }
  if (view.kind === 'why') return <WhySpareSheet spare={spare} row={view.row} onBack={() => setView({ kind: 'list' })} />;
  if (view.kind === 'draft') return <SellDraft rows={sortedAll} chosen={chosen} onBack={() => setView({ kind: 'list' })} onSent={onSent} />;

  const totals = chosenTotals(spare.rows, chosen);
  const setQuantity = (row: ISpareRow, quantity: number): void => setChosen((known) => ({ ...known, [rowKey(row)]: Math.max(0, Math.min(maxToSell(row), quantity)) }));

  return (
    <div className={styles.page} data-testid="spare-page">
      <button type="button" className={styles.back} onClick={onBack}>
        {t('spare.backToCollection')}
      </button>
      <h1 className={styles.title}>{plural(t, 'spare.title', spare.totalSpare)}</h1>
      {ruleRow(spare, () => setView({ kind: 'rule' }), t)}
      {spare.ideaDecks.map((deck) => (
        <IdeaNotice key={deck.deckId} deck={deck} />
      ))}
      {spare.rows.length === 0 ? (
        <p className={styles.empty}>{t('spare.empty')}</p>
      ) : (
        <>
          <Chips label={t('spare.sortLabel')} options={SORTS.map((entry) => ({ value: entry.sort, text: t(entry.labelKey) }))} value={sort} onChange={setSort} />
          <Chips
            label={t('spare.showLabel')}
            options={PRICE_FILTERS.map((value) => ({ value, text: t(FILTER_LABEL_KEY[String(value)] ?? 'spare.showAll') }))}
            value={filter}
            onChange={setFilter}
          />
          {visible.length === 0 ? (
            <p className={styles.empty}>{t('spare.noRowsInFilter')}</p>
          ) : (
            <ul className={styles.list} aria-label={t('spare.rowList')}>
              {visible.map((row) => (
                <SpareRowItem
                  key={rowKey(row)}
                  row={row}
                  rows={spare.rows}
                  quantity={chosen[rowKey(row)] ?? 0}
                  onQuantity={(quantity) => setQuantity(row, quantity)}
                  onWhy={(picked) => setView({ kind: 'why', row: picked })}
                  t={t}
                />
              ))}
            </ul>
          )}
          <div className={styles.bar} data-testid="spare-bar">
            {totals.copies === 0 ? (
              <button type="button" className={styles.barEmpty} disabled>
                {t('spare.barEmpty')}
              </button>
            ) : (
              <>
                <p className={styles.barTitle}>{plural(t, 'spare.chosen', totals.copies)}</p>
                <p className={styles.barTotal}>{plural(t, 'spare.barTotal', totals.copies, { price: `R$ ${totals.cents / 100}` })}</p>
                <button type="button" className={styles.barSell} onClick={() => setView({ kind: 'draft' })}>
                  {t('spare.sell')}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
