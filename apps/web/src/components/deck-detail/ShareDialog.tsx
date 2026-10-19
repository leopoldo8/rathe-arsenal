import React from 'react';
import type { TShareIntent } from '../../api/shared-decks';
import { ShareDialogFrame } from '../share/ShareDialogFrame';
import { ShareFlow } from './ShareFlow';

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

/** Share dialog of the deck detail. */
export function ShareDialog({
  deckId,
  deckName,
  missingCount,
  open,
  initialIntent,
  onOpenChange,
}: IShareDialogProps): React.ReactElement {
  return (
    <ShareDialogFrame open={open} onOpenChange={onOpenChange}>
      <ShareFlow
        deckId={deckId}
        deckName={deckName}
        missingCount={missingCount}
        initialIntent={initialIntent}
        onClose={() => onOpenChange(false)}
      />
    </ShareDialogFrame>
  );
}
