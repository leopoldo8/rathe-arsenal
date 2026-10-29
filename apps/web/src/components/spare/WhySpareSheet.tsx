import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ISpareResponse, ISpareRow } from '../../api/spare';
import { cardName } from '../../lib/card-name';
import { plural, ruleLine, whyLines } from './spareModel';
import { SpareRuleSheet } from './SpareRuleSheet';
import styles from './WhySpareSheet.module.css';

interface IWhySpareSheetProps {
  readonly spare: ISpareResponse;
  /** Any row of the card: they all carry its name, art and pitch. */
  readonly row: ISpareRow;
  readonly onBack: () => void;
}

/** "Por que sobra?": what the player has, which decks hold copies under the player's rule, and what is left. */
export function WhySpareSheet({ spare, row, onBack }: IWhySpareSheetProps): React.ReactElement | null {
  const { t } = useTranslation();
  const [changing, setChanging] = useState(false);
  const why = spare.why[row.cardIdentifier];
  if (why === undefined) return null;

  if (changing) {
    return (
      <SpareRuleSheet
        counts={spare.counts}
        initialRule={spare.rule}
        backLabel={t('spare.backToSpare')}
        onBack={() => setChanging(false)}
        onSaved={() => setChanging(false)}
      />
    );
  }

  const rule = spare.rule ?? 'per_deck';
  const lines = whyLines(why, rule, t);
  const name = cardName(row.name, row.pitch, (key) => t(key));
  const notCounting = why.notHolding.map((deck) => deck.deckName);

  return (
    <section className={styles.sheet} data-testid="why-spare-sheet">
      <button type="button" className={styles.back} onClick={onBack}>
        {t('spare.backToSpare')}
      </button>
      <header className={styles.header}>
        {row.imageUrl !== null && <img className={styles.art} src={row.imageUrl} alt="" />}
        <div>
          <p className={styles.eyebrow}>{t('spare.whyEyebrow')}</p>
          <h1 className={styles.title}>{name}</h1>
        </div>
      </header>
      <ul className={styles.table}>
        <li className={styles.line}>
          <span className={styles.lineTitle}>{t('spare.whyYouHave')}</span>
          <span className={styles.number}>{why.owned}</span>
        </li>
        {lines.map((line) => (
          <li key={line.key} className={styles.line}>
            <span className={styles.lineText}>
              <span className={styles.lineTitle}>{line.title}</span>
              {line.sub !== null && <span className={styles.lineSub}>{line.sub}</span>}
            </span>
            <span className={styles.number}>{line.count}</span>
          </li>
        ))}
        <li className={styles.line}>
          <span className={styles.lineTitle}>{t('spare.whyLeft')}</span>
          <span className={styles.number}>{why.spare}</span>
        </li>
      </ul>
      {notCounting.length > 0 && (
        <p className={styles.notCounting}>{plural(t, 'spare.whyNotCounting', notCounting.length, { names: notCounting.join(t('spare.whyNamesJoin')) })}</p>
      )}
      {spare.rule !== null && (
        <div className={styles.rule}>
          <p className={styles.ruleText}>{ruleLine(spare.rule, t)}</p>
          <button type="button" className={styles.change} onClick={() => setChanging(true)}>
            {t('spare.change')}
          </button>
        </div>
      )}
    </section>
  );
}
