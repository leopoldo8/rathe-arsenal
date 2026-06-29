import React, { ReactNode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock Radix ToggleGroup so items render as real buttons and we can capture
// the change handler — jsdom lacks Radix's pointer/measurement internals.
let captured: ((v: string) => void) | undefined;
vi.mock('@radix-ui/react-toggle-group', () => ({
  Root: ({
    children,
    onValueChange,
    value,
  }: {
    children: ReactNode;
    onValueChange?: (v: string) => void;
    value?: string;
  }) => {
    captured = onValueChange;
    return (
      <div data-testid="language-toggle" data-value={value}>
        {children}
      </div>
    );
  },
  Item: ({
    children,
    value,
    'aria-label': ariaLabel,
  }: {
    children: ReactNode;
    value: string;
    'aria-label'?: string;
  }) => (
    <button
      data-testid={`language-toggle-${value}`}
      aria-label={ariaLabel}
      onClick={() => captured?.(value)}
    >
      {children}
    </button>
  ),
}));

import i18n from '../../../i18n';
import { LanguageToggle } from '../LanguageToggle';

afterEach(async () => {
  await i18n.changeLanguage('pt-BR');
  localStorage.clear();
});

describe('LanguageToggle', () => {
  it('renders both PT and EN options with autonym aria-labels', () => {
    render(<LanguageToggle />);
    expect(screen.getByTestId('language-toggle-pt-BR')).toHaveAttribute('aria-label', 'Português');
    expect(screen.getByTestId('language-toggle-en-US')).toHaveAttribute('aria-label', 'English');
  });

  it('reflects the active locale (pt-BR) as the selected value', () => {
    render(<LanguageToggle />);
    expect(screen.getByTestId('language-toggle')).toHaveAttribute('data-value', 'pt-BR');
  });

  it('selecting EN changes the active i18n language to en-US', async () => {
    render(<LanguageToggle />);
    await userEvent.click(screen.getByTestId('language-toggle-en-US'));
    await waitFor(() => expect(i18n.language).toBe('en-US'));
  });

  it('selecting EN sets <html lang> to en-US', async () => {
    render(<LanguageToggle />);
    await userEvent.click(screen.getByTestId('language-toggle-en-US'));
    await waitFor(() => expect(document.documentElement.lang).toBe('en-US'));
  });

  it('selecting EN persists the choice to localStorage (rathe.lang)', async () => {
    render(<LanguageToggle />);
    await userEvent.click(screen.getByTestId('language-toggle-en-US'));
    await waitFor(() => expect(localStorage.getItem('rathe.lang')).toBe('en-US'));
  });

  it('switching back to PT restores pt-BR', async () => {
    render(<LanguageToggle />);
    await userEvent.click(screen.getByTestId('language-toggle-en-US'));
    await waitFor(() => expect(i18n.language).toBe('en-US'));
    await userEvent.click(screen.getByTestId('language-toggle-pt-BR'));
    await waitFor(() => expect(i18n.language).toBe('pt-BR'));
  });
});
