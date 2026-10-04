/**
 * SwapsFilters tests
 *
 * Covers:
 *  - Renders Tier, Confidence chips always visible
 *  - Deck chip appears when availableDecks is non-empty
 *  - Hero chip appears when availableHeroes is non-empty
 *  - Tier chip shows "(1, 2)" when tiers 1 and 2 are active
 *  - Clear button only appears when at least one filter is active
 *  - Clear button resets all filters to defaults
 *  - Clicking Clear shows count of active filters
 *
 * Note: Radix Popover content rendering in jsdom requires Portal; we verify
 * the trigger chips are rendered and the clear button responds correctly.
 * Deep Popover content tests would require a full jsdom environment setup
 * with Radix Popper — those are covered by Playwright E2E.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SwapsFilters } from '../SwapsFilters';
import type { ISwapsFilters } from '../SwapsFilters.helpers';
import { DEFAULT_FILTERS } from '../SwapsFilters.helpers';
import styles from '../SwapsFilters.module.css';

// ---- Helpers ----

const AVAILABLE_DECKS = [
  { id: '1', name: 'Dromai Storm' },
  { id: '2', name: 'Briar Build' },
];

const AVAILABLE_HEROES = ['Dromai', 'Briar'];

function renderFilters(
  filters: Partial<ISwapsFilters> = {},
  onChange = vi.fn(),
) {
  const merged: ISwapsFilters = { ...DEFAULT_FILTERS, ...filters };
  const view = render(
    <SwapsFilters
      filters={merged}
      availableDecks={AVAILABLE_DECKS}
      availableHeroes={AVAILABLE_HEROES}
      onChange={onChange}
    />,
  );
  const toggle = screen.getByRole('button', { name: /^Filtros/ });
  if (toggle.getAttribute('aria-expanded') === 'false') fireEvent.click(toggle);
  return { onChange, ...view };
}

// ---- Tests ----

describe('SwapsFilters — chip visibility', () => {
  it('renders the Tier filter chip', () => {
    renderFilters();
    // pt-BR label is "Nível"
    expect(screen.getByRole('button', { name: /^Nível$/i })).toBeInTheDocument();
  });

  it('renders the Confidence filter chip', () => {
    renderFilters();
    expect(screen.getByRole('button', { name: /^Confiança$/i })).toBeInTheDocument();
  });

  it('renders the Deck filter chip when availableDecks is non-empty', () => {
    renderFilters();
    expect(screen.getByRole('button', { name: /^Deck$/i })).toBeInTheDocument();
  });

  it('renders the Hero filter chip when availableHeroes is non-empty', () => {
    renderFilters();
    expect(screen.getByRole('button', { name: /^Herói$/i })).toBeInTheDocument();
  });
});

describe('SwapsFilters — active state labels', () => {
  it('Tier chip shows active tiers in label when tier filter is set', () => {
    renderFilters({ tier: [1, 2] });
    // Chip label should include the active tier values (pt-BR label is Nível)
    expect(screen.getByRole('button', { name: /Nível \(1, 2\)/i })).toBeInTheDocument();
  });

  it('Confidence chip shows range in label when confidence is not default', () => {
    renderFilters({ confidenceMin: 30, confidenceMax: 80 });
    expect(screen.getByRole('button', { name: /Confiança \(30–80\)/i })).toBeInTheDocument();
  });

  it('Deck chip shows count in label when deck filter is set', () => {
    renderFilters({ deck: ['1'] });
    expect(screen.getByRole('button', { name: /Deck \(1\)/i })).toBeInTheDocument();
  });

  it('Hero chip shows count in label when hero filter is set', () => {
    renderFilters({ hero: ['Dromai'] });
    expect(screen.getByRole('button', { name: /Herói \(1\)/i })).toBeInTheDocument();
  });
});

describe('SwapsFilters — clear button', () => {
  it('does not render Clear button when all filters are default', () => {
    renderFilters();
    expect(screen.queryByRole('button', { name: /Limpar/i })).not.toBeInTheDocument();
  });

  it('renders Clear button when tier filter is active', () => {
    renderFilters({ tier: [1] });
    expect(screen.getByRole('button', { name: /Limpar/i })).toBeInTheDocument();
  });

  it('renders Clear button when confidence is non-default', () => {
    renderFilters({ confidenceMin: 20 });
    expect(screen.getByRole('button', { name: /Limpar/i })).toBeInTheDocument();
  });

  it('Clear button shows active filter count', () => {
    // tier (1) + deck (1) = 2 active
    renderFilters({ tier: [1], deck: ['1'] });
    // The clear button's accessible name comes from its aria-label (PT-BR).
    expect(screen.getByRole('button', { name: /Limpar todos os 2 filtros ativos/i })).toBeInTheDocument();
  });

  it('clicking Clear calls onChange with DEFAULT_FILTERS', async () => {
    const onChange = vi.fn();
    renderFilters({ tier: [1, 3], deck: ['2'] }, onChange);
    await userEvent.click(screen.getByRole('button', { name: /Limpar/i }));
    expect(onChange).toHaveBeenCalledWith(DEFAULT_FILTERS);
  });
});

describe('SwapsFilters — ARIA (UXUI-13 AC1)', () => {
  it('Tier chip trigger does NOT have aria-pressed (Radix manages aria-expanded)', () => {
    renderFilters();
    expect(screen.getByRole('button', { name: /^Nível$/i })).not.toHaveAttribute('aria-pressed');
  });

  it('Deck chip trigger does NOT have aria-pressed', () => {
    renderFilters();
    expect(screen.getByRole('button', { name: /^Deck$/i })).not.toHaveAttribute('aria-pressed');
  });

  it('Hero chip trigger does NOT have aria-pressed', () => {
    renderFilters();
    expect(screen.getByRole('button', { name: /^Herói$/i })).not.toHaveAttribute('aria-pressed');
  });

  it('Confidence chip trigger does NOT have aria-pressed', () => {
    renderFilters();
    expect(screen.getByRole('button', { name: /^Confiança$/i })).not.toHaveAttribute('aria-pressed');
  });
});

describe('SwapsFilters — collapsible rail (SWAP-14)', () => {
  it('starts collapsed behind a single Filtros trigger when no filter is active', () => {
    render(
      <SwapsFilters
        filters={DEFAULT_FILTERS}
        availableDecks={AVAILABLE_DECKS}
        availableHeroes={AVAILABLE_HEROES}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Filtros' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /^Nível/ })).toBeNull();
  });

  it('opens on its own when a filter is already active, and counts the active ones', () => {
    render(
      <SwapsFilters
        filters={{ ...DEFAULT_FILTERS, tier: [1], hero: ['Dromai'] }}
        availableDecks={AVAILABLE_DECKS}
        availableHeroes={AVAILABLE_HEROES}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Filtros (2)' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('button', { name: /^Nível/ })).toBeInTheDocument();
  });

  it('opens and closes from the trigger', async () => {
    renderFilters();
    const toggle = screen.getByRole('button', { name: 'Filtros' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: /^Nível/ })).toBeNull();
  });
});

describe('SwapsFilters — trigger styling', () => {
  it('carries the toggle class, and the active class only while a filter is on', () => {
    const { unmount } = render(
      <SwapsFilters filters={DEFAULT_FILTERS} availableDecks={[]} availableHeroes={[]} onChange={vi.fn()} />,
    );
    const idle = screen.getByRole('button', { name: 'Filtros' });
    expect(idle).toHaveClass(styles.toggle!);
    expect(idle).not.toHaveClass(styles.toggleActive!);
    unmount();

    render(
      <SwapsFilters filters={{ ...DEFAULT_FILTERS, tier: [1] }} availableDecks={[]} availableHeroes={[]} onChange={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Filtros (1)' })).toHaveClass(styles.toggle!, styles.toggleActive!);
  });

  it('wraps the trigger and the rail in the wrapper class', () => {
    const { container } = render(
      <SwapsFilters filters={DEFAULT_FILTERS} availableDecks={[]} availableHeroes={[]} onChange={vi.fn()} />,
    );

    expect(container.firstElementChild).toHaveClass(styles.wrapper!);
  });
});
