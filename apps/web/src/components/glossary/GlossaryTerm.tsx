import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlossarySheet } from './GlossarySheet';
import { glossaryEntry, type TGlossaryOwnData, type TGlossaryTermId } from './glossary-model';
import { useIsFirstAppearance } from './glossary-scope';
import styles from './GlossaryTerm.module.css';

interface IGlossaryQuestionProps {
  readonly term: TGlossaryTermId;
  readonly onOpen: (anchor: HTMLButtonElement) => void;
}

/** The "?" itself: 20 px drawn inside a 44 px target, named "O que é <word>?". */
export function GlossaryQuestion({ term, onOpen }: IGlossaryQuestionProps): React.ReactElement {
  const { t } = useTranslation();
  const { word } = glossaryEntry(term, t);
  return (
    <button
      type="button"
      className={styles.question}
      aria-label={t('glossary.whatIs', { word })}
      data-testid={`glossary-question-${term}`}
      onClick={(event) => onOpen(event.currentTarget)}
    >
      <span className={styles.circle} aria-hidden="true">
        ?
      </span>
    </button>
  );
}

interface IGlossaryTermProps {
  readonly term: TGlossaryTermId;
  /** The word as the page writes it; the glossary's own word when omitted. */
  readonly children?: React.ReactNode;
  /** What the page knows about the player's own data, for the line under the sentence. */
  readonly own?: TGlossaryOwnData | undefined;
  /** Draw only the "?", for a spot where the word is shown some other way (the dots of a legend). */
  readonly bare?: boolean;
}

/**
 * A game word with a "?" after it. Only the first appearance of the word on a screen (inside a
 * `GlossaryScope`) carries the "?"; the others stay plain text.
 */
export function GlossaryTerm({ term, children, own, bare = false }: IGlossaryTermProps): React.ReactElement {
  const { t } = useTranslation();
  const isFirst = useIsFirstAppearance(term);
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLElement | null>(null);
  const word = bare ? null : (children ?? glossaryEntry(term, t).word);

  return (
    <span className={styles.term}>
      {word}
      {isFirst && (
        <>
          <GlossaryQuestion
            term={term}
            onOpen={(anchor) => {
              anchorRef.current = anchor;
              setOpen(true);
            }}
          />
          <GlossarySheet term={term} own={own} open={open} onOpenChange={setOpen} anchorRef={anchorRef} />
        </>
      )}
    </span>
  );
}
