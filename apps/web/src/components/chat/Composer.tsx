import React from 'react';
import { useTranslation } from 'react-i18next';
import { MESSAGE_MAX_LENGTH } from '../../api/chat';
import styles from './Composer.module.css';

interface IComposerProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSend: (text: string) => void;
  readonly placeholder: string;
  readonly disabled: boolean;
  readonly error: string | null;
}

function SendIcon(): React.ReactElement {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4z" />
    </svg>
  );
}

export function Composer({ value, onChange, onSend, placeholder, disabled, error }: IComposerProps): React.ReactElement {
  const { t } = useTranslation();
  const canSend = !disabled && value.trim() !== '';

  function send(): void {
    if (canSend) onSend(value.trim());
  }

  return (
    <form
      className={styles.composer}
      data-disabled={disabled ? 'true' : undefined}
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      {error !== null && (
        <p role="alert" className={styles.error} data-testid="composer-error">
          {error}
        </p>
      )}
      <div className={styles.field}>
        <textarea
          className={styles.input}
          aria-label={t('chat.composerLabel')}
          placeholder={placeholder}
          value={value}
          rows={1}
          maxLength={MESSAGE_MAX_LENGTH}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send();
            }
          }}
        />
        <button type="submit" className={styles.send} disabled={!canSend} aria-label={t('chat.send')}>
          <SendIcon />
        </button>
      </div>
    </form>
  );
}
