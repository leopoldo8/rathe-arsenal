import React from 'react';
import { useTranslation } from 'react-i18next';
import { CardArt } from '../card-art/CardArt';
import { cardName } from '../../lib/card-name';
import { cardTypeLabel } from './cardTypeLabel';
import type { TRuleChangedCard } from './ruleChangedModel';
import styles from './RuleChangedNotice.module.css';

interface IRuleChangedRowProps {
  readonly card: TRuleChangedCard;
  readonly format: string;
  readonly limit: number;
  readonly disabled: boolean;
  readonly onTakeOne: (cardIdentifier: string) => void;
}

const ART_WIDTH_PX = 52;

export function RuleChangedRow({ card, format, limit, disabled, onTakeOne }: IRuleChangedRowProps): React.ReactElement {
  const { t } = useTranslation();
  const name = cardName(card.name, card.pitch, t);
  const total = card.quantity + (card.inventoryQuantity ?? 0);
  const meta =
    card.cost === null
      ? cardTypeLabel(card.type, t)
      : t('deckDetail.rowTypeCost', { type: cardTypeLabel(card.type, t), cost: card.cost });

  return (
    <li className={styles.row} data-testid={`rule-changed-row-${card.cardIdentifier}`}>
      <CardArt
        name={name}
        pitch={null}
        cost={null}
        type={card.type}
        missing={false}
        size="sm"
        widthOverride={ART_WIDTH_PX}
        imageUrl={card.imageUrl}
      />
      <div className={styles.text}>
        <div className={styles.name}>{name}</div>
        <div className={styles.meta}>{meta}</div>
        <div className={styles.problem}>
          {t('deckDetail.rowCopiesOver', { count: total, format, limit, extra: total - limit })}
        </div>
      </div>
      <div className={styles.stepper} role="group" aria-label={t('decks.cardQuantityGroupAria', { name })}>
        <button
          type="button"
          className={styles.stepperBtn}
          aria-label={t('decks.decreaseQuantityAria', { name })}
          disabled={disabled}
          onClick={() => onTakeOne(card.cardIdentifier)}
        >
          &minus;
        </button>
        <span className={styles.quantity} aria-live="polite" aria-atomic="true">
          {total}
        </span>
        <button
          type="button"
          className={styles.stepperBtn}
          aria-label={t('decks.increaseQuantityAria', { name })}
          disabled
        >
          +
        </button>
      </div>
    </li>
  );
}
