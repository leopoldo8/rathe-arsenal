import React, { useState } from 'react';
import { RULE_CHANGES, type IRuleChange } from '@rathe-arsenal/engine/legality';
import { useTranslation } from 'react-i18next';
import type { IDeckLegality } from '../../api/decks';
import { usePutDeckMutation } from '../../api/decks';
import { useToast } from '../ui/Toast/useToast';
import { RuleChangedRow } from './RuleChangedRow';
import { barText } from './rulesChecklistModel';
import {
  deckSizeOf,
  findRuleChangedProblem,
  formatRuleDate,
  sizeRulesOf,
  takeOneCopy,
  toPutBody,
  type TRuleChangedCard,
} from './ruleChangedModel';
import styles from './RuleChangedNotice.module.css';

interface IRuleChangedNoticeProps {
  readonly deckId: number;
  readonly format: string;
  readonly heroIdentifier: string | null;
  readonly legality: IDeckLegality;
  /** The saved lines of the deck, one per card and slot. */
  readonly cards: readonly TRuleChangedCard[];
  readonly ruleChanges?: readonly IRuleChange[];
}

export function RuleChangedNotice({
  deckId,
  format,
  heroIdentifier,
  legality,
  cards,
  ruleChanges = RULE_CHANGES,
}: IRuleChangedNoticeProps): React.ReactElement | null {
  const { t, i18n } = useTranslation();
  const { show } = useToast();
  const put = usePutDeckMutation(deckId);
  const [dismissed, setDismissed] = useState(false);
  const [applied, setApplied] = useState(false);

  const problem = findRuleChangedProblem(format, legality.details, cards, ruleChanges);
  const sizeRules = sizeRulesOf(format);
  const resultLine =
    applied && sizeRules !== null ? (
      <p className={styles.result} role="status" data-testid="rule-change-result">
        {barText(
          { deckSize: deckSizeOf(cards), target: sizeRules.target, exact: sizeRules.exact, problemCount: ruleProblemCount(legality) },
          t,
        )}
      </p>
    ) : null;
  if (problem === null) return resultLine;

  const failed = (): void => show({ kind: 'error', message: t('deckDetail.ruleChangeFailed') });

  function save(next: readonly TRuleChangedCard[], onSaved: () => void): void {
    put.mutate(toPutBody(next, heroIdentifier, format), { onSuccess: onSaved, onError: failed });
  }

  function takeOne(cardIdentifier: string): void {
    save(takeOneCopy(cards, cardIdentifier), () => undefined);
  }

  function keepOneOfEach(current: IRuleChangedProblemView): void {
    const original = cards;
    const next = current.cards.reduce((all, card) => takeOneCopy(all, card.cardIdentifier), cards);
    save(next, () => {
      setApplied(true);
      show({
        kind: 'info',
        message: t('deckDetail.ruleChangeTaken', { count: current.cards.length }),
        persistent: true,
        dismissOnNextAction: true,
        action: {
          label: t('deckDetail.ruleChangeUndo'),
          onClick: () => save(original, () => setApplied(false)),
        },
      });
    });
  }

  const count = problem.cards.length;
  const target = sizeRules?.target ?? 0;
  const limit = sizeRules?.maxCopies ?? 1;
  const after = deckSizeOf(cards) - count;
  const hintKey = after < target ? 'deckDetail.ruleChangeKeepOneHint' : 'deckDetail.ruleChangeKeepOneHintFull';

  return (
    <>
      <section className={styles.section} data-testid="rule-changed">
        {!dismissed && (
          <div className={styles.notice}>
            <p className={styles.summary}>
              {t(`deckDetail.ruleChangeSummary.${problem.change.summaryKey}`, {
                date: formatRuleDate(problem.change.effectiveDate, i18n.language),
                count,
              })}
            </p>
            <a className={styles.source} href={problem.change.sourceUrl} target="_blank" rel="noopener noreferrer">
              {t('deckDetail.ruleChangeSource')}
              <span aria-hidden="true"> ↗</span>
            </a>
          </div>
        )}
        <ul className={styles.rows}>
          {problem.cards.map((card) => (
            <RuleChangedRow
              key={`${card.cardIdentifier}-${card.slot}`}
              card={card}
              format={format}
              limit={limit}
              disabled={put.isPending}
              onTakeOne={takeOne}
            />
          ))}
        </ul>
        {!dismissed && (
          <div className={styles.actions}>
            <button type="button" className={styles.keepOne} disabled={put.isPending} onClick={() => keepOneOfEach(problem)}>
              {t('deckDetail.ruleChangeKeepOne')}
            </button>
            <p className={styles.hint}>
              {t(hintKey, { count, after, target, add: target - after })}
            </p>
            <button type="button" className={styles.byHand} onClick={() => setDismissed(true)}>
              {t('deckDetail.ruleChangeByHand')}
            </button>
          </div>
        )}
      </section>
      {resultLine}
    </>
  );
}

type IRuleChangedProblemView = NonNullable<ReturnType<typeof findRuleChangedProblem>>;

function ruleProblemCount(legality: IDeckLegality): number {
  return (legality.details ?? []).filter(
    (detail) => detail.code !== 'mainboard_not_exact' && detail.code !== 'mainboard_too_small',
  ).length;
}
