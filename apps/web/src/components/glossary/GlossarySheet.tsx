import React from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Popover from '@radix-ui/react-popover';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { useIsPhone } from '../auth/useIsPhone';
import {
  GLOSSARY_ORIGIN_KEY,
  glossaryEntry,
  glossaryOwnLine,
  type TGlossaryOwnData,
  type TGlossaryTermId,
} from './glossary-model';
import styles from './GlossarySheet.module.css';

export interface IGlossarySheetProps {
  readonly term: TGlossaryTermId;
  readonly own?: TGlossaryOwnData | undefined;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** The "?" that opened the sheet: a popover anchors to it and focus returns to it on every way of closing. */
  readonly anchorRef: React.RefObject<HTMLElement | null>;
}

function currentAddress(): string {
  return `${window.location.pathname}${window.location.search}`;
}

interface ISheetBodyProps extends Pick<IGlossarySheetProps, 'term' | 'own' | 'onOpenChange'> {
  /** The heading: the dialog's own title on a phone, a plain heading in the popover. */
  readonly renderTitle: (word: string) => React.ReactNode;
}

function SheetBody({ term, own, onOpenChange, renderTitle }: ISheetBodyProps): React.ReactElement {
  const { t } = useTranslation();
  const entry = glossaryEntry(term, t);
  const ownLine = glossaryOwnLine(term, own, t);
  const origin = { path: currentAddress() };

  return (
    <>
      {renderTitle(entry.word)}
      <p className={styles.sentence}>{entry.sentence}</p>
      {ownLine !== null && (
        <p className={styles.own} data-testid="glossary-own-line">
          {ownLine}
        </p>
      )}
      <div className={styles.actions}>
        <Link
          to="/termos"
          hash={term}
          state={((previous: Record<string, unknown>) => ({ ...previous, [GLOSSARY_ORIGIN_KEY]: origin })) as never}
          className={styles.seeAll}
          onClick={() => onOpenChange(false)}
        >
          {t('glossary.seeAll')}
        </Link>
        <button type="button" className={styles.close} onClick={() => onOpenChange(false)}>
          {t('glossary.close')}
        </button>
      </div>
    </>
  );
}

/**
 * The explanation of one word: a bottom sheet on a phone, a popover anchored to the "?" on a computer.
 * Escape, a tap outside and "Fechar" all close it and give focus back to the "?".
 */
export function GlossarySheet({ term, own, open, onOpenChange, anchorRef }: IGlossarySheetProps): React.ReactElement | null {
  const isPhone = useIsPhone();
  const titleId = React.useId();
  const returnFocus = (event: Event): void => {
    event.preventDefault();
    anchorRef.current?.focus();
  };

  if (isPhone) {
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className={styles.overlay} />
          <Dialog.Content
            className={styles.sheet}
            aria-describedby={undefined}
            onCloseAutoFocus={returnFocus}
            data-testid="glossary-sheet"
          >
            <span className={styles.handle} aria-hidden="true" />
            <SheetBody
              term={term}
              own={own}
              onOpenChange={onOpenChange}
              renderTitle={(word) => <Dialog.Title className={styles.title}>{word}</Dialog.Title>}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={onOpenChange}>
      <Popover.Anchor virtualRef={anchorRef as React.RefObject<{ getBoundingClientRect: () => DOMRect }>} />
      <Popover.Portal>
        <Popover.Content
          className={styles.popover}
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          aria-labelledby={titleId}
          onCloseAutoFocus={returnFocus}
          data-testid="glossary-popover"
        >
          <SheetBody
            term={term}
            own={own}
            onOpenChange={onOpenChange}
            renderTitle={(word) => (
              <h2 id={titleId} className={styles.title}>
                {word}
              </h2>
            )}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
