import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TShareIntent } from '../../api/shared-decks';
import styles from '../share/ShareSteps.module.css';

interface IShareIntentStepProps {
  readonly missingCount: number;
  readonly onChoose: (intent: TShareIntent) => void;
}

const ICON_PROPS = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

const ICONS: Readonly<Record<TShareIntent, React.ReactElement>> = {
  deck: (
    <svg {...ICON_PROPS}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  missing: (
    <svg {...ICON_PROPS}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  ),
  quote: (
    <svg {...ICON_PROPS}>
      <path d="M4 9l1.5-5h13L20 9" />
      <path d="M4 9h16v11H4z" />
      <path d="M10 20v-5h4v5" />
    </svg>
  ),
};

const INTENTS: readonly TShareIntent[] = ['deck', 'missing', 'quote'];

/** Second step: what the link is for. Each option says in one line what the visitor will see; none is preselected. */
export function ShareIntentStep({ missingCount, onChoose }: IShareIntentStepProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <>
      {INTENTS.map((intent) => {
        const needsMissing = intent !== 'deck';
        const unavailable = needsMissing && missingCount === 0;
        return (
          <button
            key={intent}
            type="button"
            className={styles.option}
            disabled={unavailable}
            onClick={() => onChoose(intent)}
            data-testid={`share-intent-${intent}`}
          >
            <span className={styles.optionIcon}>{ICONS[intent]}</span>
            <span className={styles.optionText}>
              <span className={styles.optionTitle}>{t(`sharing.dialog.intent.${intent}.title`)}</span>
              <span className={styles.optionBody}>
                {unavailable ? t(`sharing.dialog.intent.${intent}.none`) : t(`sharing.dialog.intent.${intent}.body`)}
              </span>
            </span>
            <span className={styles.optionChevron} aria-hidden="true">
              &#8250;
            </span>
          </button>
        );
      })}
    </>
  );
}
