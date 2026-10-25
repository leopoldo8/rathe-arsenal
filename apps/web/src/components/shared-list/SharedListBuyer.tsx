import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ISharedListMatches, ISharedListResponse } from '../../api/shared-lists';
import { cardName } from '../../lib/card-name';
import { plural } from '../spare/spareModel';
import { ShareMessageView } from './ShareMessageView';
import { RowStepper, Thumb } from './VisitorRowParts';
import { buildBuyMessage, buyerDetail, buyerRows, chosenTotal, reaisOf, setCount, type TSelection } from './visitorListModel';
import styles from './VisitorList.module.css';

interface ISharedListBuyerProps {
  readonly list: ISharedListResponse;
  /** The visitor's deck gaps per line; undefined while they load or when they cannot. */
  readonly matches: ISharedListMatches | undefined;
}

/** A signed-in visitor on someone's sell list: pick the copies they want, read the message, send it. */
export function SharedListBuyer({ list, matches }: ISharedListBuyerProps): React.ReactElement {
  const { t } = useTranslation();
  const [selection, setSelection] = useState<TSelection>({});
  const [reading, setReading] = useState(false);
  const rows = buyerRows(list, matches);
  const total = chosenTotal(rows, selection);
  const fits = rows.filter((row) => row.hint !== null).length;

  if (reading) {
    return (
      <ShareMessageView
        backLabel={t('sharing.buyer.back', { name: list.sharerName })}
        initialText={buildBuyMessage(list.sharerName, rows, selection, t)}
        whatsapp={list.contactWhatsapp}
        onBack={() => setReading(false)}
      />
    );
  }

  return (
    <div className={styles.view} data-testid="shared-list-buyer">
      <p className={styles.eyebrow}>{t('sharing.buyer.eyebrow')}</p>
      <h1 className={styles.title}>{t('sharing.buyer.title', { name: list.sharerName })}</h1>
      {matches !== undefined && (
        <p className={styles.summary} data-testid="shared-list-summary">
          {fits > 0 ? plural(t, 'sharing.buyer.summary', fits) : t('sharing.buyer.summaryNone')}
        </p>
      )}
      <ul className={styles.list}>
        {rows.map(({ line, hint }) => {
          const label = cardName(line.name, line.pitch, (key) => t(key));
          const count = selection[line.id] ?? 0;
          const detail = buyerDetail(line, t);
          return (
            <li key={line.id} className={styles.row} data-testid="buyer-row">
              <input
                type="checkbox"
                className={styles.check}
                aria-label={t('sharing.buyer.select', { name: label })}
                checked={count > 0}
                onChange={(event) => setSelection(setCount(selection, line.id, event.currentTarget.checked ? 1 : 0))}
              />
              <Thumb line={line} label={label} />
              <div className={styles.rowText}>
                <span className={styles.name}>{label}</span>
                {detail !== '' && <p className={styles.meta}>{detail}</p>}
                {hint !== null && <p className={styles.good}>{plural(t, 'sharing.buyer.hint', hint.missing, { deck: hint.deck })}</p>}
              </div>
              <RowStepper
                value={count}
                max={line.quantity}
                increaseLabel={t('sharing.buyer.increase', { name: label })}
                decreaseLabel={t('sharing.buyer.decrease', { name: label })}
                onChange={(value) => setSelection(setCount(selection, line.id, value))}
              />
            </li>
          );
        })}
      </ul>
      {total.copies > 0 && (
        <div className={styles.bar} data-testid="buyer-bar">
          <p className={styles.barTotal}>
            {total.priced ? t('sharing.buyer.bar', { price: reaisOf(total.cents) }) : t('sharing.buyer.barNoPrice')}
          </p>
          <button type="button" className={styles.barButton} onClick={() => setReading(true)}>
            {t('sharing.buyer.viewMessage')}
          </button>
        </div>
      )}
    </div>
  );
}
