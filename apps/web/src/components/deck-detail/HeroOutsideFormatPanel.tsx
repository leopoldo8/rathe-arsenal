import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { IDeckLegality } from '../../api/decks';
import { usePatchDeckMutation } from '../../api/decks';
import { useToast } from '../ui/Toast/useToast';
import {
  describeProblem,
  describeValidIn,
  hasHeroOutsideFormat,
  ruleDetails,
  type IOtherFormatVerdict,
} from './heroOutsideFormatModel';
import styles from './HeroOutsideFormatPanel.module.css';

interface IHeroOutsideFormatPanelProps {
  readonly deckId: number;
  readonly format: string;
  readonly legality: IDeckLegality;
  readonly otherFormats: readonly IOtherFormatVerdict[];
}

export function HeroOutsideFormatPanel({
  deckId,
  format,
  legality,
  otherFormats,
}: IHeroOutsideFormatPanelProps): React.ReactElement | null {
  const { t, i18n } = useTranslation();
  const { show } = useToast();
  const patch = usePatchDeckMutation(deckId);
  const [switchedTo, setSwitchedTo] = useState<string | null>(null);

  function failed(): void {
    show({ kind: 'error', message: t('deckDetail.outsideSwitchFailed') });
  }

  function undo(previous: string): void {
    patch.mutate({ format: previous }, { onSuccess: () => setSwitchedTo(null), onError: failed });
  }

  function switchTo(target: string): void {
    patch.mutate(
      { format: target },
      {
        onSuccess: () => {
          setSwitchedTo(target);
          show({
            kind: 'info',
            message: t('deckDetail.outsideSwitchedToast', { format: target }),
            persistent: true,
            dismissOnNextAction: true,
            action: { label: t('deckDetail.outsideUndo'), onClick: () => undo(format) },
          });
        },
        onError: failed,
      },
    );
  }

  if (switchedTo !== null) {
    return (
      <section className={styles.valid} data-testid="outside-format-switched">
        <p className={styles.validLine}>{t('deckDetail.outsideSwitched', { format: switchedTo })}</p>
      </section>
    );
  }
  if (!hasHeroOutsideFormat(legality.details)) return null;

  const problems = ruleDetails(legality.details);
  const validFormats = otherFormats.filter((verdict) => verdict.category === 'legal');

  return (
    <div className={styles.panel} data-testid="hero-outside-format">
      <section className={styles.problem}>
        <h2 className={styles.title}>{t('deckDetail.outsideTitle', { format })}</h2>
        <ul className={styles.list}>
          {problems.map((detail, index) => (
            <li key={`${detail.code}-${index}`}>{describeProblem(detail, t, i18n.language)}</li>
          ))}
        </ul>
      </section>

      {validFormats.map((verdict) => (
        <section key={verdict.format} className={styles.valid}>
          <p className={styles.validLine}>{describeValidIn(verdict.format, problems, t, i18n.language)}</p>
          <button type="button" className={styles.switch} disabled={patch.isPending} onClick={() => switchTo(verdict.format)}>
            {t('deckDetail.outsideSwitch', { format: verdict.format })}
          </button>
          <p className={styles.note}>{t('deckDetail.outsideSwitchNote')}</p>
        </section>
      ))}

      {validFormats.length === 0 &&
        otherFormats.map((verdict) => (
          <div key={verdict.format} role="group" aria-label={t('deckDetail.outsideFormatGroup', { format: verdict.format })} className={styles.problem}>
            <h3 className={styles.groupTitle}>{t('deckDetail.outsideFormatGroup', { format: verdict.format })}</h3>
            <ul className={styles.list}>
              {verdict.details.map((detail, index) => (
                <li key={`${detail.code}-${index}`}>{describeProblem(detail, t, i18n.language)}</li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  );
}
