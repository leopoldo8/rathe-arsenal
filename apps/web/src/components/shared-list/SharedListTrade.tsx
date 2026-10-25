import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ISharedListResponse } from '../../api/shared-lists';
import { useSpareQuery } from '../../api/spare';
import { cardName } from '../../lib/card-name';
import { SpareRuleSheet } from '../spare/SpareRuleSheet';
import { plural } from '../spare/spareModel';
import { ShareMessageView } from './ShareMessageView';
import { RowStepper, Thumb } from './VisitorRowParts';
import {
  buildOfferMessage,
  offerCents,
  offerCopies,
  reaisOf,
  setCount,
  tradeRows,
  wantCents,
  wantCopies,
  type TSelection,
} from './visitorListModel';
import styles from './VisitorList.module.css';

/** The rule question first (the counts depend on it), asked on this page under its own heading. */
function RuleQuestion(): React.ReactElement | null {
  const query = useSpareQuery();
  if (query.data === undefined) return null;
  return <SpareRuleSheet counts={query.data.counts} initialRule={null} headingKey="spare.groupAsk" embedded />;
}

/** A signed-in visitor on someone's want list: what they can spare of it, and the offer they can send. */
export function SharedListTrade({ list }: { readonly list: ISharedListResponse }): React.ReactElement {
  const { t } = useTranslation();
  const [selection, setSelection] = useState<TSelection>({});
  const [includeMine, setIncludeMine] = useState(false);
  const [reading, setReading] = useState(false);
  const rows = tradeRows(list);
  const own = list.visitorList ?? null;
  const chosenCopies = Object.values(selection).reduce((sum, count) => sum + count, 0);

  if (reading) {
    return (
      <ShareMessageView
        backLabel={t('sharing.trade.back', { name: list.sharerName })}
        initialText={buildOfferMessage(list, rows.spare, selection, includeMine, t)}
        whatsapp={list.contactWhatsapp}
        onBack={() => setReading(false)}
      />
    );
  }

  const header = (
    <>
      <p className={styles.eyebrow}>{list.name}</p>
      <h1 className={styles.title}>{t('sharing.trade.title', { name: list.sharerName })}</h1>
    </>
  );
  if (list.spareNeedsRule === true) {
    return (
      <div className={styles.view} data-testid="shared-list-trade">
        {header}
        <RuleQuestion />
      </div>
    );
  }

  const summary = offerCopies(rows.spare);
  const lackingNames = rows.lacking.map((line) => cardName(line.name, line.pitch, (key) => t(key))).join(', ');

  return (
    <div className={styles.view} data-testid="shared-list-trade">
      {header}
      <p className={styles.summary} data-testid="shared-list-summary">
        {summary.copies > 0
          ? t('sharing.trade.summary', {
              copies: plural(t, 'sharing.trade.copies', summary.copies),
              cards: plural(t, 'sharing.trade.cards', summary.cards),
              name: list.sharerName,
            })
          : t('sharing.trade.summaryNone', { name: list.sharerName })}
      </p>
      <ul className={styles.list}>
        {rows.spare.map(({ line, offerable }) => {
          const label = cardName(line.name, line.pitch, (key) => t(key));
          const wants = t('sharing.trade.wants', { name: list.sharerName, count: line.quantity });
          const suggested = line.suggestedCents === null || line.suggestedCents === undefined ? '' : ` · ${t('sharing.trade.suggested', { price: reaisOf(line.suggestedCents) })}`;
          return (
            <li key={line.id} className={styles.row} data-testid="trade-row">
              <Thumb line={line} label={label} />
              <div className={styles.rowText}>
                <span className={styles.name}>{label}</span>
                <p className={styles.meta}>{`${wants}${suggested}`}</p>
                <p className={styles.good}>{t('sharing.trade.youHave', { owned: line.owned ?? 0, spare: line.spare ?? 0 })}</p>
              </div>
              <RowStepper
                value={selection[line.id] ?? 0}
                max={offerable}
                increaseLabel={t('sharing.trade.increase', { name: label })}
                decreaseLabel={t('sharing.trade.decrease', { name: label })}
                onChange={(value) => setSelection(setCount(selection, line.id, value))}
              />
            </li>
          );
        })}
        {rows.none.map((line) => {
          const label = cardName(line.name, line.pitch, (key) => t(key));
          const wants = t('sharing.trade.wants', { name: list.sharerName, count: line.quantity });
          const suggested = line.suggestedCents === null || line.suggestedCents === undefined ? '' : ` · ${t('sharing.trade.suggested', { price: reaisOf(line.suggestedCents) })}`;
          return (
            <li key={line.id} className={styles.row} data-testid="trade-row">
              <Thumb line={line} label={label} />
              <div className={styles.rowText}>
                <span className={styles.name}>{label}</span>
                <p className={styles.meta}>{`${wants}${suggested}`}</p>
                <p className={styles.meta}>
                  {line.spareReason === null || line.spareReason === undefined
                    ? t('sharing.trade.youHaveNone', { owned: line.owned ?? 0 })
                    : plural(t, 'sharing.trade.youHaveReason', line.spareReason.copies, { owned: line.owned ?? 0, deck: line.spareReason.deckName })}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {rows.lacking.length > 0 && <p className={styles.lacking}>{plural(t, 'sharing.trade.lacking', rows.lacking.length, { names: lackingNames })}</p>}
      {own !== null && (
        <label className={styles.mine}>
          <span className={styles.mineText}>
            <span>{t('sharing.trade.includeMine')}</span>
            <span className={styles.mineList}>
              {t('sharing.trade.includeMineList', { name: own.name, copies: plural(t, 'sharing.trade.copies', wantCopies(list)) })}
            </span>
          </span>
          <input
            type="checkbox"
            role="switch"
            className={styles.mineSwitch}
            checked={includeMine}
            onChange={(event) => setIncludeMine(event.currentTarget.checked)}
          />
        </label>
      )}
      {own !== null && includeMine && (
        <p className={styles.value} data-testid="trade-value">
          {t('sharing.trade.value', { offer: reaisOf(offerCents(rows.spare, selection)), want: reaisOf(wantCents(list)) })}
        </p>
      )}
      <div className={styles.bar} data-testid="trade-bar">
        <button type="button" className={styles.barButton} disabled={chosenCopies === 0} onClick={() => setReading(true)}>
          {t('sharing.trade.viewMessage')}
        </button>
      </div>
    </div>
  );
}
