import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TagFilterChips } from '../TagFilterChips';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderChips(
  availableTags: string[],
  activeFilterTags: string[] = [],
  onFilterChange = vi.fn(),
) {
  return render(
    <TagFilterChips
      availableTags={availableTags}
      activeFilterTags={activeFilterTags}
      onFilterChange={onFilterChange}
    />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TagFilterChips', () => {
  it('renders nothing when availableTags is empty', () => {
    const { container } = renderChips([]);
    expect(container.firstChild).toBeNull();
  });

  it('renders a chip for each available tag', () => {
    renderChips(['league', 'casual', 'competitive']);
    expect(screen.getByRole('button', { name: /filter by tag: league/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter by tag: casual/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filter by tag: competitive/i })).toBeInTheDocument();
  });

  it('inactive chips have aria-pressed=false', () => {
    renderChips(['league'], []);
    const chip = screen.getByRole('button', { name: /filter by tag: league/i });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
  });

  it('active chips have aria-pressed=true', () => {
    renderChips(['league'], ['league']);
    const chip = screen.getByRole('button', { name: /filter by tag: league/i });
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  it('clicking an inactive chip calls onFilterChange with the tag added', () => {
    const onFilterChange = vi.fn();
    renderChips(['league', 'casual'], [], onFilterChange);
    const chip = screen.getByRole('button', { name: /filter by tag: league/i });
    fireEvent.click(chip);

    expect(onFilterChange).toHaveBeenCalledOnce();
    expect(onFilterChange).toHaveBeenCalledWith(['league']);
  });

  it('clicking an active chip calls onFilterChange with the tag removed', () => {
    const onFilterChange = vi.fn();
    renderChips(['league', 'casual'], ['league', 'casual'], onFilterChange);
    const chip = screen.getByRole('button', { name: /filter by tag: league/i });
    fireEvent.click(chip);

    expect(onFilterChange).toHaveBeenCalledOnce();
    expect(onFilterChange).toHaveBeenCalledWith(['casual']);
  });

  it('clicking a second chip ORs it with the first (adds to the filter set)', () => {
    const onFilterChange = vi.fn();
    renderChips(['league', 'casual'], ['league'], onFilterChange);
    const chip = screen.getByRole('button', { name: /filter by tag: casual/i });
    fireEvent.click(chip);

    expect(onFilterChange).toHaveBeenCalledOnce();
    const newTags = onFilterChange.mock.calls[0]?.[0] as string[];
    expect(newTags).toContain('league');
    expect(newTags).toContain('casual');
  });

  it('does not show Clear button when no tag is active', () => {
    renderChips(['league'], []);
    expect(screen.queryByRole('button', { name: /clear all tag filters/i })).not.toBeInTheDocument();
  });

  it('shows Clear button when at least one tag is active', () => {
    renderChips(['league'], ['league']);
    expect(screen.getByRole('button', { name: /clear all tag filters/i })).toBeInTheDocument();
  });

  it('clicking Clear calls onFilterChange with []', () => {
    const onFilterChange = vi.fn();
    renderChips(['league', 'casual'], ['league', 'casual'], onFilterChange);
    const clearBtn = screen.getByRole('button', { name: /clear all tag filters/i });
    fireEvent.click(clearBtn);

    expect(onFilterChange).toHaveBeenCalledOnce();
    expect(onFilterChange).toHaveBeenCalledWith([]);
  });

  it('renders the component as a group with an accessible label', () => {
    renderChips(['league']);
    expect(screen.getByRole('group', { name: /filter by tag/i })).toBeInTheDocument();
  });

  it('active chip has distinct visual styling class (chipActive)', () => {
    const { container } = renderChips(['league'], ['league']);
    const chip = container.querySelector('[aria-pressed="true"]');
    // The chip should have the chipActive class applied
    expect(chip?.className).toMatch(/chipActive/);
  });

  it('inactive chip does not have chipActive class', () => {
    const { container } = renderChips(['league', 'casual'], ['league']);
    const inactiveChip = container.querySelector('[aria-pressed="false"]');
    expect(inactiveChip?.className).not.toMatch(/chipActive/);
  });

  describe('URL filter persistence via onFilterChange', () => {
    it('preserving other search params is the caller responsibility (tested in home.tsx integration)', () => {
      // TagFilterChips delegates to onFilterChange — the test for URL param
      // preservation lives in the home route integration tests. Here we just
      // verify the callback receives the correct new tag array.
      const onFilterChange = vi.fn();
      renderChips(['foo', 'bar'], ['foo'], onFilterChange);
      fireEvent.click(screen.getByRole('button', { name: /filter by tag: bar/i }));
      expect(onFilterChange).toHaveBeenCalledWith(['foo', 'bar']);
    });
  });
});
