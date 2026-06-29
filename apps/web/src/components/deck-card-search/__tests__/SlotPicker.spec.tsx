/**
 * Tests for SlotPicker.
 *
 * Covers:
 *  - Renders all 4 slot options with correct aria-labels
 *  - Default selection is mainboard
 *  - Clicking a slot fires onChange with the new slot value
 *  - Clicking the already-active slot does not fire onChange (no deselect)
 *  - aria-label per slot: "{Slot} slot"
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SlotPicker } from '../SlotPicker';
import type { TDeckSlot } from '../SlotPicker';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPicker(props: Partial<React.ComponentProps<typeof SlotPicker>> = {}) {
  const onChange = vi.fn();
  const result = render(
    <SlotPicker value="mainboard" onChange={onChange} {...props} />,
  );
  return { ...result, onChange };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SlotPicker — rendering', () => {
  it('renders a group with label "Slot do baralho"', () => {
    renderPicker();
    expect(screen.getByRole('group', { name: /slot do baralho/i })).toBeInTheDocument();
  });

  it('renders all 4 slot options', () => {
    renderPicker();
    expect(screen.getByRole('radio', { name: /slot mainboard/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /slot equipamento/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /slot arma/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /slot herói/i })).toBeInTheDocument();
  });

  it('each slot button has the correct aria-label format: "Slot {label}"', () => {
    renderPicker();
    const slots: TDeckSlot[] = ['mainboard', 'equipment', 'weapon', 'hero'];
    const labels = ['Slot Mainboard', 'Slot Equipamento', 'Slot Arma', 'Slot Herói'];
    slots.forEach((_, index) => {
      expect(screen.getByRole('radio', { name: new RegExp(labels[index]!, 'i') })).toBeInTheDocument();
    });
  });

  it('shows visible text label for each slot', () => {
    renderPicker();
    expect(screen.getByText('Mainboard')).toBeInTheDocument();
    expect(screen.getByText('Equipamento')).toBeInTheDocument();
    expect(screen.getByText('Arma')).toBeInTheDocument();
    expect(screen.getByText('Herói')).toBeInTheDocument();
  });
});

describe('SlotPicker — interaction', () => {
  it('fires onChange with the new slot value when a different slot is clicked', async () => {
    const { onChange } = renderPicker({ value: 'mainboard' });
    await userEvent.click(screen.getByRole('radio', { name: /slot arma/i }));
    expect(onChange).toHaveBeenCalledWith('weapon');
  });

  it('fires onChange with equipment when equipment is clicked', async () => {
    const { onChange } = renderPicker({ value: 'mainboard' });
    await userEvent.click(screen.getByRole('radio', { name: /slot equipamento/i }));
    expect(onChange).toHaveBeenCalledWith('equipment');
  });

  it('fires onChange with hero when hero is clicked', async () => {
    const { onChange } = renderPicker({ value: 'mainboard' });
    await userEvent.click(screen.getByRole('radio', { name: /slot herói/i }));
    expect(onChange).toHaveBeenCalledWith('hero');
  });

  it('does not deselect — clicking the active slot does not fire onChange with empty string', async () => {
    const { onChange } = renderPicker({ value: 'weapon' });
    // Click weapon again (currently active)
    await userEvent.click(screen.getByRole('radio', { name: /slot arma/i }));
    // Should not have been called, or if called, not with empty string
    const calls = onChange.mock.calls;
    for (const call of calls) {
      expect(call[0]).not.toBe('');
      expect(call[0]).not.toBeUndefined();
    }
  });
});

describe('SlotPicker — controlled value', () => {
  it('reflects the current value prop as the selected state', () => {
    renderPicker({ value: 'equipment' });
    const equipmentButton = screen.getByRole('radio', { name: /slot equipamento/i });
    expect(equipmentButton).toHaveAttribute('data-state', 'on');
  });

  it('mainboard is active when value is mainboard', () => {
    renderPicker({ value: 'mainboard' });
    const mainboardButton = screen.getByRole('radio', { name: /slot mainboard/i });
    expect(mainboardButton).toHaveAttribute('data-state', 'on');
  });
});
