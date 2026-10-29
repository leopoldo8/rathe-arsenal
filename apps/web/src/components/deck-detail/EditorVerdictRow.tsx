import React from 'react';
import { useTranslation } from 'react-i18next';
import { isSizeProblem, type IDeckLegalityResult } from '@rathe-arsenal/engine/legality';
import type { TDeckStatus } from '../../api/decks';
import { ShareDialog } from './ShareDialog';
import { STATUS_KEY_MAP } from './status-labels';
import styles from './EditorVerdictRow.module.css';

interface IEditorVerdictRowProps {
  readonly deckId: number;
  readonly deckName: string;
  readonly format: string;
  readonly status: TDeckStatus;
  /** The engine's verdict on the draft; null while the draft's hero is still loading. */
  readonly legality: IDeckLegalityResult | null;
  /** Copies still to acquire, as the missing-cards link will count them. */
  readonly missingCount: number;
}

/**
 * The format chip and "Compartilhar" of the editor, and the verdict of the draft: when a rule is
 * broken the red chip says so and the stage drops to a grey line, so a rule problem never hides
 * behind the player's own label.
 */
export function EditorVerdictRow({
  deckId,
  deckName,
  format,
  status,
  legality,
  missingCount,
}: IEditorVerdictRowProps): React.ReactElement {
  const { t } = useTranslation();
  const [shareOpen, setShareOpen] = React.useState(false);
  const hasRuleProblem = legality !== null && legality.details.some((detail) => !isSizeProblem(detail));

  return (
    <div className={styles.row} data-testid="editor-verdict-row">
      <div className={styles.chips}>
        <span className={styles.formatChip}>{format}</span>
        <button type="button" className={styles.shareBtn} onClick={() => setShareOpen(true)}>
          {t('sharing.dialog.trigger')}
        </button>
      </div>
      {hasRuleProblem && (
        <>
          <span className={styles.verdict} data-testid="editor-verdict">
            {t('deckDetail.verdictBlocked', { format })}
          </span>
          <span className={styles.stage}>{t('deckDetail.stageLine', { stage: t(STATUS_KEY_MAP[status]) })}</span>
        </>
      )}
      {legality?.category === 'unchecked' && (
        <span className={styles.unchecked} data-testid="editor-verdict">
          {t('decks.formatUnchecked')}
        </span>
      )}
      <ShareDialog
        deckId={deckId}
        deckName={deckName}
        missingCount={missingCount}
        open={shareOpen}
        initialIntent={null}
        onOpenChange={setShareOpen}
      />
    </div>
  );
}
