import React from 'react';
import type { ICardList } from '../../api/lists';
import { ShareDialogFrame } from '../share/ShareDialogFrame';
import { ListShareFlow } from './ListShareFlow';

interface IListShareDialogProps {
  readonly list: ICardList;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/** Share dialog of the list editor: the same fixed-size dialog as the deck's, without the choice of intent. */
export function ListShareDialog({ list, open, onOpenChange }: IListShareDialogProps): React.ReactElement {
  return (
    <ShareDialogFrame open={open} onOpenChange={onOpenChange}>
      <ListShareFlow list={list} onClose={() => onOpenChange(false)} />
    </ShareDialogFrame>
  );
}
