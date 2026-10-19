import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { TShareIntent } from '../../api/shared-decks';
import { ShareFlow } from './ShareFlow';
import styles from './ShareDialog.module.css';

interface IShareDialogProps {
  readonly deckId: number;
  readonly deckName: string;
  /** Copies still to acquire, as the missing-cards link will count them. */
  readonly missingCount: number;
  readonly open: boolean;
  /** Skips the choice and goes straight to this link (the shopping-list call to action). */
  readonly initialIntent: TShareIntent | null;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * Share dialog of the deck detail: a centred dialog on desktop and a bottom
 * sheet on phones. It keeps one fixed size across its steps, so nothing
 * behind it moves and the dialog never grows while the owner works through it.
 */
export function ShareDialog({
  deckId,
  deckName,
  missingCount,
  open,
  initialIntent,
  onOpenChange,
}: IShareDialogProps): React.ReactElement {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.panel} aria-describedby={undefined} data-testid="share-dialog">
          <ShareFlow
            deckId={deckId}
            deckName={deckName}
            missingCount={missingCount}
            initialIntent={initialIntent}
            onClose={() => onOpenChange(false)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
