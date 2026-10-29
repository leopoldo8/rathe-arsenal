import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ILineSuggestion, TColorOption } from '../../api/collection-imports';
import { cardName, pitchWord } from '../../lib/card-name';
import styles from './CollectionReader.module.css';

const DOT_CLASS: Readonly<Record<number, string>> = {
  1: styles.dotRed!,
  2: styles.dotYellow!,
  3: styles.dotBlue!,
};

interface IColorChoicesProps {
  readonly options: readonly TColorOption[];
  /** The list screen draws the three colors only; the report adds "Não sei". */
  readonly showUnknown: boolean;
  readonly declined: boolean;
  readonly onPick: (option: TColorOption) => void;
}

/** "Qual cor?": the colors the card is printed in, as buttons. */
export function ColorChoices({ options, showUnknown, declined, onPick }: IColorChoicesProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div className={styles.choices}>
      {options.map((option) =>
        option.kind === 'pitch' ? (
          <button key={option.pitch} type="button" className={styles.choice} aria-pressed="false" onClick={() => onPick(option)}>
            <span className={`${styles.dot} ${DOT_CLASS[option.pitch]}`} aria-hidden="true" />
            {pitchWord(option.pitch, t)}
          </button>
        ) : showUnknown ? (
          <button key="unknown" type="button" className={`${styles.choice} ${styles.unknown}`} aria-pressed={declined} onClick={() => onPick(option)}>
            {t('collectionReader.colorUnknown')}
          </button>
        ) : null,
      )}
    </div>
  );
}

function Thumb({ suggestion }: { readonly suggestion: ILineSuggestion }): React.ReactElement {
  return suggestion.imageUrl === null ? (
    <span className={styles.thumb} aria-hidden="true" />
  ) : (
    <img className={styles.thumb} src={suggestion.imageUrl.small} alt="" loading="lazy" />
  );
}

interface ISuggestionBlockProps {
  readonly suggestion: ILineSuggestion;
  readonly onUse: () => void;
  readonly onCorrect: () => void;
}

/** "Você quis dizer <card>?" with the card's image; counted only after "Usar esta". */
export function SuggestionBlock({ suggestion, onUse, onCorrect }: ISuggestionBlockProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <>
      <div className={styles.suggestion}>
        <Thumb suggestion={suggestion} />
        <p className={styles.lineTitle}>
          {t('collectionReader.suggestionLead')} <strong>{cardName(suggestion.name, suggestion.pitch, t)}</strong>?
        </p>
      </div>
      <div className={styles.pair}>
        <button type="button" className={styles.actionPrimary} onClick={onUse}>
          {t('collectionReader.useThis')}
        </button>
        <button type="button" className={styles.action} onClick={onCorrect}>
          {t('collectionReader.correct')}
        </button>
      </div>
    </>
  );
}

interface ISearchBlockProps {
  readonly lineNumber: number;
  readonly initialText: string;
  readonly searching: boolean;
  /** Shown above the field; the list screen says what was not found. */
  readonly headline: string | null;
  readonly onSearch: (text: string) => void;
}

/** An edit field holding the line's text and "Procurar", which reads that line only. */
export function SearchBlock({ lineNumber, initialText, searching, headline, onSearch }: ISearchBlockProps): React.ReactElement {
  const { t } = useTranslation();
  const [text, setText] = useState(initialText);
  return (
    <>
      {headline !== null && <p className={styles.lineTitle}>{headline}</p>}
      <div className={styles.editRow}>
        <input
          className={styles.field}
          value={text}
          aria-label={t('collectionReader.editLineAria', { line: lineNumber })}
          onChange={(event) => setText(event.target.value)}
        />
        <button type="button" className={styles.actionPrimary} disabled={searching || text.trim() === ''} onClick={() => onSearch(text)}>
          {searching ? t('collectionReader.searching') : t('collectionReader.search')}
        </button>
      </div>
    </>
  );
}

interface IQuantityBlockProps {
  readonly lineNumber: number;
  readonly raw: string | null;
  readonly suggested: number | null;
  readonly onUse: (quantity: number) => void;
}

/** A quantity that is not a number: the field is prefilled with the number the word names, with "Usar N". */
export function QuantityBlock({ lineNumber, raw, suggested, onUse }: IQuantityBlockProps): React.ReactElement {
  const { t } = useTranslation();
  const [value, setValue] = useState(suggested === null ? '' : String(suggested));
  const parsed = /^\d+$/.test(value) ? Number(value) : null;
  const usable = parsed !== null && parsed >= 1 ? Math.min(parsed, 20) : null;
  return (
    <>
      <p className={styles.note}>
        {raw === null || raw === '' ? t('collectionReader.quantityEmpty') : t('collectionReader.quantityNotNumber', { raw })}
      </p>
      <div className={styles.editRow}>
        <input
          className={styles.field}
          inputMode="numeric"
          value={value}
          aria-label={t('collectionReader.quantityAria', { line: lineNumber })}
          onChange={(event) => setValue(event.target.value)}
        />
        <button type="button" className={styles.actionPrimary} disabled={usable === null} onClick={() => usable !== null && onUse(usable)}>
          {t('collectionReader.useQuantity', { count: usable ?? 0 })}
        </button>
      </div>
    </>
  );
}
