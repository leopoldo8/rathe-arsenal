/**
 * Tests for LibraryFilterRail — replaces the old LibraryFilters tests.
 * Covers the new control set: pitch pills, class/talent/set toggle rows
 * with counts, search-within input, snap-thresholds slider, clear-all.
 *
 * Assertions use PT-BR strings (i18n default in test harness).
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { setTestLocale } from '../../../test/i18n-test-utils';

const linkSpy = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { to: string; className?: string; children: React.ReactNode }) => {
    linkSpy(props);
    return (
      <a href={props.to} className={props.className}>
        {props.children}
      </a>
    );
  },
}));

import { LibraryFilterRail } from '../LibraryFilterRail';
import styles from '../LibraryFilterRail.module.css';
import type { ILibraryFiltersValue } from '../LibraryFilterRail';
import type { ILibraryCard } from '../../../api/library';

const EMPTY_FILTERS: ILibraryFiltersValue = {
  pitches: [],
  types: [],
  classes: [],
  talents: [],
  sets: [],
  group: 'type',
  cardSize: 120,
};

function makeCard(overrides: Partial<ILibraryCard> = {}): ILibraryCard {
  return {
    cardIdentifier: 'WTR000',
    name: 'Test Card',
    pitch: null,
    types: ['attack'],
    subtypes: [],
    classes: [],
    talents: [],
    sets: ['WTR'],
    imageUrl: null,
    ownedQuantity: 1,
    contributions: [],
    ...overrides,
  };
}

const SAMPLE_CARDS: readonly ILibraryCard[] = [
  makeCard({ cardIdentifier: 'WTR001', name: 'Hammer', pitch: 1, classes: ['Brute'], sets: ['WTR'] }),
  makeCard({ cardIdentifier: 'CRU001', name: 'Arrow', pitch: 2, classes: ['Ranger'], sets: ['CRU'], talents: ['Lightning'] }),
  makeCard({ cardIdentifier: 'CRU002', name: 'Shield', pitch: 3, classes: ['Guardian'], sets: ['CRU'] }),
];

function renderRail(props: Partial<React.ComponentProps<typeof LibraryFilterRail>> = {}) {
  const defaults: React.ComponentProps<typeof LibraryFilterRail> = {
    cards: SAMPLE_CARDS,
    value: EMPTY_FILTERS,
    onChange: vi.fn(),
    searchQuery: '',
    onSearchChange: vi.fn(),
    matchingCount: SAMPLE_CARDS.length,
  };
  return render(<LibraryFilterRail {...defaults} {...props} />);
}

describe('LibraryFilterRail — search input', () => {
  it('exposes a labeled search input (pt-BR label)', () => {
    renderRail();
    const input = screen.getByLabelText(/buscar cartas na biblioteca pelo nome/i);
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'search');
  });

  it('emits onSearchChange when the user types', async () => {
    const onSearchChange = vi.fn();
    renderRail({ onSearchChange });
    const input = screen.getByLabelText(/buscar cartas/i);
    await userEvent.type(input, 'a');
    expect(onSearchChange).toHaveBeenCalledWith('a');
  });

  it('renders the matching chip with the matching count when search is at least 2 chars', () => {
    renderRail({ searchQuery: 'sh', matchingCount: 7 });
    expect(screen.getByText(/resultados:/i)).toBeInTheDocument();
    // The count is rendered in a span inside the chip — scope by aria-live.
    const chip = screen.getByText(/resultados:/i).closest('p');
    expect(chip).toHaveTextContent(/Resultados:\s*7/i);
  });

  it('hides the matching chip below 2 chars', () => {
    renderRail({ searchQuery: 's' });
    expect(screen.queryByText(/resultados:/i)).not.toBeInTheDocument();
  });
});

describe('LibraryFilterRail — pitch pills', () => {
  it('renders four pitch pills as toggle buttons (pt-BR labels)', () => {
    renderRail();
    expect(screen.getByRole('checkbox', { name: /Pitch Vermelho/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Pitch Amarelo/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Pitch Azul/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Pitch Sem cor/i })).toBeInTheDocument();
  });

  it('toggles the pitch in onChange when clicked', async () => {
    const onChange = vi.fn();
    renderRail({ onChange });
    await userEvent.click(screen.getByRole('checkbox', { name: /Pitch Vermelho/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ pitches: ['red'] }),
    );
  });

  it('removes an already-selected pitch on click', async () => {
    const onChange = vi.fn();
    renderRail({
      value: { ...EMPTY_FILTERS, pitches: ['red'] },
      onChange,
    });
    await userEvent.click(screen.getByRole('checkbox', { name: /Pitch Vermelho/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ pitches: [] }),
    );
  });
});

describe('LibraryFilterRail — class/talent/set accordion sections', () => {
  it('collapses by default and reveals options when expanded', async () => {
    renderRail();
    // Brute is hidden behind the collapsed Classe accordion.
    expect(screen.queryByRole('checkbox', { name: /Brute/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Classe/i }));
    expect(screen.getByRole('checkbox', { name: /Brute/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Ranger/i })).toBeInTheDocument();
  });

  it('opens automatically when the section already has selections', () => {
    renderRail({
      value: { ...EMPTY_FILTERS, classes: ['Brute'] },
    });
    // Pre-selected → accordion opens on mount, Brute row is in the DOM.
    expect(screen.getByRole('checkbox', { name: /Brute/i })).toBeInTheDocument();
  });

  it('shows the empty-talent hint inside the talent accordion when expanded', async () => {
    renderRail({
      cards: [makeCard({ classes: ['Brute'] })],
    });
    await userEvent.click(screen.getByRole('button', { name: /Talento/i }));
    expect(
      screen.getByText(/nenhuma das suas cartas tem talento/i),
    ).toBeInTheDocument();
  });

  it('emits onChange with the new selection when a row is toggled', async () => {
    const onChange = vi.fn();
    renderRail({ onChange });
    await userEvent.click(screen.getByRole('button', { name: /Classe/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Brute/i }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ classes: ['Brute'] }),
    );
  });

  it('exposes aria-expanded on the accordion trigger', async () => {
    renderRail();
    const trigger = screen.getByRole('button', { name: /Classe/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('LibraryFilterRail — card-size slider', () => {
  it('renders the slider with the current value (pt-BR aria-label)', () => {
    renderRail({ value: { ...EMPTY_FILTERS, cardSize: 160 } });
    const slider = screen.getByRole('slider', { name: /tamanho das cartas/i });
    expect(slider).toHaveValue('160');
  });

  it('snaps onChange to a configured threshold when dragged', () => {
    const onChange = vi.fn();
    renderRail({ onChange });
    const slider = screen.getByRole('slider', { name: /tamanho das cartas/i });
    fireEvent.change(slider, { target: { value: '162' } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ cardSize: 160 }),
    );
  });
});

describe('LibraryFilterRail — group-by segmented control', () => {
  it('renders all four group options as radios (pt-BR labels for Type/Flat)', () => {
    renderRail();
    expect(screen.getByRole('radio', { name: /^Tipo$/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Pitch$/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Set$/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /^Lista$/ })).toBeInTheDocument();
  });

  it('marks the active group with aria-checked=true', () => {
    renderRail({ value: { ...EMPTY_FILTERS, group: 'pitch' } });
    expect(screen.getByRole('radio', { name: /^Pitch$/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('radio', { name: /^Tipo$/ })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });
});

describe('LibraryFilterRail — clear all', () => {
  it('renders the clear-all button with the active filter count when filters exist (pt-BR)', () => {
    renderRail({
      value: {
        ...EMPTY_FILTERS,
        pitches: ['red'],
        classes: ['Brute'],
      },
    });
    expect(screen.getByRole('button', { name: /limpar todos os filtros/i })).toBeInTheDocument();
    expect(screen.getByText(/\(2\)/)).toBeInTheDocument();
  });

  it('hides the clear-all button when no filter is active', () => {
    renderRail();
    expect(
      screen.queryByRole('button', { name: /limpar todos os filtros/i }),
    ).not.toBeInTheDocument();
  });

  it('calls onChange and onSearchChange to clear everything', async () => {
    const onChange = vi.fn();
    const onSearchChange = vi.fn();
    renderRail({
      value: { ...EMPTY_FILTERS, pitches: ['red'] },
      searchQuery: 'sh',
      onChange,
      onSearchChange,
    });
    await userEvent.click(screen.getByRole('button', { name: /limpar todos/i }));
    expect(onSearchChange).toHaveBeenCalledWith('');
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        pitches: [],
        classes: [],
        talents: [],
        sets: [],
      }),
    );
  });
});

describe('LibraryFilterRail — card-size legend (LIB-02)', () => {
  const SIZE_LABELS: ReadonlyArray<readonly [number, string, string]> = [
    [80, 'Pequeno', 'Small'],
    [120, 'Médio', 'Medium'],
    [160, 'Grande', 'Large'],
    [200, 'Extra grande', 'X-Large'],
    [240, 'Máximo', 'Max'],
  ];

  it.each(SIZE_LABELS)('exposes the %ipx step as aria-valuetext and legend in pt-BR', (size, pt) => {
    renderRail({ value: { ...EMPTY_FILTERS, cardSize: size } });
    const slider = screen.getByRole('slider', { name: /tamanho das cartas/i });
    expect(slider).toHaveAttribute('aria-valuetext', pt);
    expect(screen.getByText(pt)).toBeInTheDocument();
    expect(screen.queryByText(`${size}px`)).toBeNull();
  });

  it.each(SIZE_LABELS)('localizes the %ipx step under en-US', async (size, _pt, en) => {
    await setTestLocale('en-US');
    renderRail({ value: { ...EMPTY_FILTERS, cardSize: size } });
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuetext', en);
  });
});

describe('LibraryFilterRail — sources link (LIB-01)', () => {
  it('renders the Manage sources link through the router Link to /library-csv-sources', () => {
    linkSpy.mockClear();
    renderRail();
    const link = screen.getByRole('link', { name: /gerenciar fontes/i });
    expect(link).toHaveAttribute('href', '/library-csv-sources');
    expect(linkSpy).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/library-csv-sources' }),
    );
  });

  it('localizes the link under en-US', async () => {
    await setTestLocale('en-US');
    renderRail();
    expect(screen.getByRole('link', { name: 'Manage sources ›' })).toBeInTheDocument();
  });

  it('keeps the link class the stylesheet keys on', () => {
    renderRail();
    expect(screen.getByRole('link', { name: /gerenciar fontes/i })).toHaveClass(styles.sourcesLink!);
  });
});

describe('LibraryFilterRail — pitch chips carry pitch-coloured classes (LIB-04)', () => {
  it.each(['red', 'yellow', 'blue', 'colorless'] as const)('%s chip has its tone class', (tone) => {
    renderRail();
    const label = { red: /Vermelho/, yellow: /Amarelo/, blue: /Azul/, colorless: /Sem cor/ }[tone];
    const chip = screen.getByRole('checkbox', { name: label });
    expect(chip).toHaveClass(styles[`pitchPill--${tone}`]!);
  });
});
