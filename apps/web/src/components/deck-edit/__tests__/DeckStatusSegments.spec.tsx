import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { TDeckStatus } from '../../../api/decks';
import { DeckStatusSegments } from '../DeckStatusSegments';
import { STATUS_SEGMENT_ORDER } from '../deckEditModel';
import styles from '../DeckStatusSegments.module.css';

function cls(name: string | undefined): string {
  if (!name) throw new Error('css module class is missing');
  return name;
}

const ALL_STATUSES: readonly TDeckStatus[] = ['idea', 'building', 'ready', 'active', 'retired'];

describe('DeckStatusSegments (EDIT-03)', () => {
  it('offers all five lifecycle statuses, none duplicated', () => {
    expect([...STATUS_SEGMENT_ORDER].sort()).toEqual([...ALL_STATUSES].sort());
    render(<DeckStatusSegments value="active" onChange={vi.fn()} />);
    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });

  it.each(ALL_STATUSES)('selecting %s reports exactly that status', (status) => {
    const onChange = vi.fn();
    const other: TDeckStatus = status === 'idea' ? 'active' : 'idea';
    render(<DeckStatusSegments value={other} onChange={onChange} />);

    fireEvent.click(screen.getByTestId(`status-segment-${status}`));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(status);
  });

  it.each(ALL_STATUSES)('marks only %s as checked when it is the value', (status) => {
    render(<DeckStatusSegments value={status} onChange={vi.fn()} />);

    const checked = screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(checked).toHaveLength(1);
    expect(checked[0]).toBe(screen.getByTestId(`status-segment-${status}`));
  });

  it('puts the active class on the selected segment only', () => {
    render(<DeckStatusSegments value="ready" onChange={vi.fn()} />);

    for (const status of ALL_STATUSES) {
      const segment = screen.getByTestId(`status-segment-${status}`);
      expect(segment).toHaveClass(cls(styles.segment));
      if (status === 'ready') expect(segment).toHaveClass(cls(styles.segmentActive));
      else expect(segment).not.toHaveClass(cls(styles.segmentActive));
    }
  });

  it('labels each segment with the localized status name', () => {
    render(<DeckStatusSegments value="active" onChange={vi.fn()} />);
    expect(screen.getByTestId('status-segment-retired')).toHaveTextContent('Aposentado');
    expect(screen.getByTestId('status-segment-ready')).toHaveTextContent('Pronto');
  });

  it('moves the selection with the arrow keys and wraps around', () => {
    const onChange = vi.fn();
    const last = STATUS_SEGMENT_ORDER[STATUS_SEGMENT_ORDER.length - 1]!;
    render(<DeckStatusSegments value={last} onChange={onChange} />);

    fireEvent.keyDown(screen.getByTestId(`status-segment-${last}`), { key: 'ArrowRight' });

    expect(onChange).toHaveBeenCalledWith(STATUS_SEGMENT_ORDER[0]);
  });

  it('keeps only the selected segment in the tab order', () => {
    render(<DeckStatusSegments value="building" onChange={vi.fn()} />);
    expect(screen.getByTestId('status-segment-building')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('status-segment-idea')).toHaveAttribute('tabindex', '-1');
  });

  it('does not report a change while disabled', () => {
    const onChange = vi.fn();
    render(<DeckStatusSegments value="idea" onChange={onChange} disabled />);
    fireEvent.click(screen.getByTestId('status-segment-active'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
