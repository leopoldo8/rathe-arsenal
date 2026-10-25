import React from 'react';
import { useTranslation } from 'react-i18next';
import type { IRulesChecklist } from './rulesChecklistModel';
import styles from './RulesChecklistSheet.module.css';

const RULES_SHEET_ID = 'rules-checklist-sheet';

interface IRulesBarProps {
  readonly checklist: IRulesChecklist;
  readonly open: boolean;
  readonly onToggle: () => void;
}

export function RulesBar({ checklist, open, onToggle }: IRulesBarProps): React.ReactElement {
  return (
    <button
      type="button"
      className={styles.bar}
      aria-expanded={open}
      aria-controls={RULES_SHEET_ID}
      data-testid="rules-bar"
      onClick={onToggle}
    >
      <span className={styles.barText}>{checklist.barText}</span>
      <span className={styles.chevron} aria-hidden="true">›</span>
    </button>
  );
}

interface IRulesChecklistSheetProps {
  readonly checklist: IRulesChecklist;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onGoToCard: (cardIdentifier: string) => void;
}

export function RulesChecklistSheet({ checklist, open, onClose, onGoToCard }: IRulesChecklistSheetProps): React.ReactElement | null {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <section
      id={RULES_SHEET_ID}
      className={styles.sheet}
      aria-label={t('deckDetail.rulesSheetAria')}
      data-testid="rules-checklist-sheet"
    >
      <button
        type="button"
        className={styles.handle}
        aria-label={t('deckDetail.rulesSheetHandleAria')}
        data-testid="rules-sheet-handle"
        onClick={onClose}
      >
        <span className={styles.handleBar} aria-hidden="true" />
      </button>
      <div className={styles.body}>
        <ul className={styles.lines}>
          {checklist.lines.map((line) => (
            <li key={line.key} className={styles.line} data-tone={line.tone}>
              <span className={styles.mark} aria-hidden="true" />
              <span className={styles.lineText}>
                <span>{line.text}</span>
                {line.cardIdentifier !== undefined && (
                  <>
                    {' · '}
                    <button
                      type="button"
                      className={styles.goTo}
                      onClick={() => onGoToCard(line.cardIdentifier as string)}
                    >
                      {t('deckDetail.goToCard')}
                    </button>
                  </>
                )}
                {line.hint !== undefined && <span className={styles.hint}>{line.hint}</span>}
              </span>
            </li>
          ))}
        </ul>
        {checklist.closeSteps !== null && <p className={styles.closeSteps}>{checklist.closeSteps}</p>}
        <button type="button" className={styles.closeBtn} onClick={onClose}>
          {t('deckDetail.rulesSheetClose')}
        </button>
      </div>
    </section>
  );
}
