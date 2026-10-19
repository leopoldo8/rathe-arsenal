import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import styles from './ShareDialogFrame.module.css';

interface IShareDialogFrameProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly children: React.ReactNode;
}

/**
 * Shell of every share dialog: a centred dialog on desktop and a bottom
 * sheet on phones. It keeps one fixed size across its steps, so nothing
 * behind it moves and the dialog never grows while the owner works through it.
 */
export function ShareDialogFrame({ open, onOpenChange, children }: IShareDialogFrameProps): React.ReactElement {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.panel} aria-describedby={undefined} data-testid="share-dialog">
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
