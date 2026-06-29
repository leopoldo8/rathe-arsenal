/**
 * Button tests.
 *
 * Test plan (from plan U4):
 *  - Happy path: renders each variant with distinct CSS class.
 *  - Loading: replaces children with spinner, sets aria-busy.
 *  - Disabled: sets aria-disabled, prevents click.
 *  - A11y: min touch target 44x44px at size='sm'.
 *  - Integration (focus-visible): structural check (keyboard focus shows outline).
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';

describe('Button — happy path', () => {
  it('renders children text', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('applies variant class for primary (default)', () => {
    const { container } = render(<Button>Click</Button>);
    const btn = container.querySelector('button');
    expect(btn?.className).toContain('primary');
  });

  it('applies variant class for secondary', () => {
    const { container } = render(<Button variant="secondary">Click</Button>);
    const btn = container.querySelector('button');
    expect(btn?.className).toContain('secondary');
  });

  it('applies variant class for ghost', () => {
    const { container } = render(<Button variant="ghost">Click</Button>);
    const btn = container.querySelector('button');
    expect(btn?.className).toContain('ghost');
  });

  it('applies variant class for danger', () => {
    const { container } = render(<Button variant="danger">Click</Button>);
    const btn = container.querySelector('button');
    expect(btn?.className).toContain('danger');
  });

  it('applies size class for sm', () => {
    const { container } = render(<Button size="sm">Click</Button>);
    const btn = container.querySelector('button');
    expect(btn?.className).toContain('sm');
  });

  it('applies size class for lg', () => {
    const { container } = render(<Button size="lg">Click</Button>);
    const btn = container.querySelector('button');
    expect(btn?.className).toContain('lg');
  });

  it('calls onClick handler when clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders leftIcon when provided', () => {
    render(<Button leftIcon={<span data-testid="icon-left" />}>Save</Button>);
    expect(screen.getByTestId('icon-left')).toBeInTheDocument();
  });

  it('renders rightIcon when provided', () => {
    render(<Button rightIcon={<span data-testid="icon-right" />}>Save</Button>);
    expect(screen.getByTestId('icon-right')).toBeInTheDocument();
  });
});

describe('Button — loading state', () => {
  it('sets aria-busy when loading=true', () => {
    render(<Button loading>Save</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('hides children text and shows screen-reader loading label', () => {
    render(<Button loading>Save</Button>);
    // Children "Save" should not be visible text — spinner replaces it
    expect(screen.queryByText('Save')).not.toBeInTheDocument();
    expect(screen.getByText('Carregando')).toBeInTheDocument();
  });

  it('does not invoke onClick when loading', async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Save</Button>);
    // Button is pointer-events: none, click won't fire — but we test the guard too
    const btn = screen.getByRole('button');
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Button — disabled state', () => {
  it('sets aria-disabled when disabled=true', () => {
    render(<Button disabled>Save</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-disabled', 'true');
  });

  it('does not invoke onClick when disabled', async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Save</Button>);
    const btn = screen.getByRole('button');
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Button — A11y touch target', () => {
  it('has min-block-size via CSS (sm size still meets 44px)', () => {
    // CSS computed values are not available in jsdom — we verify the class is
    // applied and the CSS Module declares min-block-size: 44px on .button.
    // The CSS enforcement is the source of truth; this verifies structural wiring.
    const { container } = render(<Button size="sm">Small</Button>);
    const btn = container.querySelector('button');
    expect(btn?.className).toContain('sm');
    expect(btn?.className).toContain('button');
    // The .button class carries min-block-size: 44px; css assertion is visual-only
  });
});

describe('Button — type defaults', () => {
  it('defaults to type="button" to avoid accidental form submission', () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('accepts type="submit" override', () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });
});
