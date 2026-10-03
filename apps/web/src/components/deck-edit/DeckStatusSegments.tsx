import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { TDeckStatus } from '../../api/decks';
import { StatusBullet } from '../deck-detail/StatusBullet';
import { STATUS_KEY_MAP } from '../deck-detail/status-labels';
import { STATUS_SEGMENT_ORDER } from './deckEditModel';
import styles from './DeckStatusSegments.module.css';

interface IDeckStatusSegmentsProps {
  readonly value: TDeckStatus;
  readonly onChange: (status: TDeckStatus) => void;
  readonly disabled?: boolean;
}

export function DeckStatusSegments({
  value,
  onChange,
  disabled = false,
}: IDeckStatusSegmentsProps): React.ReactElement {
  const { t } = useTranslation();
  const refs = useRef<Partial<Record<TDeckStatus, HTMLButtonElement | null>>>({});

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number): void {
    const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1
      : 0;
    if (step === 0) return;
    event.preventDefault();
    const nextIndex = (index + step + STATUS_SEGMENT_ORDER.length) % STATUS_SEGMENT_ORDER.length;
    const next = STATUS_SEGMENT_ORDER[nextIndex]!;
    onChange(next);
    refs.current[next]?.focus();
  }

  return (
    <div
      className={styles.group}
      role="radiogroup"
      aria-label={t('deckEdit.statusGroupAria')}
      data-testid="deck-status-segments"
    >
      {STATUS_SEGMENT_ORDER.map((status, index) => {
        const selected = status === value;
        return (
          <button
            key={status}
            ref={(node) => {
              refs.current[status] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            className={[styles.segment, selected ? styles.segmentActive : ''].filter(Boolean).join(' ')}
            data-testid={`status-segment-${status}`}
            onClick={() => onChange(status)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            <StatusBullet status={status} showLabel={false} />
            <span>{t(STATUS_KEY_MAP[status])}</span>
          </button>
        );
      })}
    </div>
  );
}
