import React, { useState } from 'react';
import { formatMoneyInput, parseMoney } from './listsModel';
import styles from './ListEditor.module.css';

interface IMoneyInputProps {
  readonly id: string;
  readonly cents: number | null;
  readonly placeholder: string;
  readonly invalidMessage: string;
  readonly onCommit: (cents: number | null) => void;
}

/** A BRL field that commits on blur or Enter; an unreadable value stays on screen, flagged. */
export function MoneyInput({ id, cents, placeholder, invalidMessage, onCommit }: IMoneyInputProps): React.ReactElement {
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  function commit(): void {
    if (draft === null) return;
    const parsed = parseMoney(draft);
    if (!parsed.valid) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(null);
    if (parsed.cents !== cents) onCommit(parsed.cents);
  }

  return (
    <>
      <input
        id={id}
        className={styles.panelField}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        value={draft ?? (cents === null ? '' : `R$ ${formatMoneyInput(cents)}`)}
        onFocus={() => setDraft(formatMoneyInput(cents))}
        onChange={(event) => {
          setInvalid(false);
          setDraft(event.currentTarget.value);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
        }}
      />
      {invalid && (
        <p id={`${id}-error`} className={styles.fieldError} role="alert">
          {invalidMessage}
        </p>
      )}
    </>
  );
}
