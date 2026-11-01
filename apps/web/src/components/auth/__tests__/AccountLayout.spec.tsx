import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { stubViewport } from './accountTestKit';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

import { AccountLayout } from '../AccountLayout';

describe('AccountLayout', () => {
  describe('from 720 px wide', () => {
    it('shows the art panel with the brand box and the tagline beside the screen', () => {
      stubViewport(false);
      render(
        <AccountLayout title="Entrar">
          <p>the screen</p>
        </AccountLayout>,
      );

      expect(screen.getByTestId('deckbox')).toHaveAttribute('data-variant', 'brand');
      expect(screen.getByText('Seus decks, sua coleção.')).toBeInTheDocument();
      expect(screen.getByText('the screen')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Entrar');
    });

    it('keeps the one heading for screen readers only when the screen opens the page itself', () => {
      stubViewport(false);
      render(
        <AccountLayout title="Rathe Arsenal" hideTitle>
          <p>the screen</p>
        </AccountLayout>,
      );

      expect(screen.getByRole('heading', { level: 1 })).toHaveClass('sr-only');
    });

    it('ends with the Legend Story Studios notice and the "Sobre" link', () => {
      stubViewport(false);
      render(
        <AccountLayout title="Entrar">
          <p>the screen</p>
        </AccountLayout>,
      );

      expect(screen.getByText(/Legend Story Studios/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Sobre' })).toHaveAttribute('href', '/about');
    });
  });

  describe('under 720 px wide', () => {
    it('stays the one-column card, with no art panel', () => {
      stubViewport(true);
      render(
        <AccountLayout title="Entrar">
          <p>the screen</p>
        </AccountLayout>,
      );

      expect(screen.queryByTestId('deckbox')).not.toBeInTheDocument();
      expect(screen.queryByText('Seus decks, sua coleção.')).not.toBeInTheDocument();
      expect(screen.getByRole('main')).toContainElement(screen.getByText('the screen'));
      expect(screen.getByRole('link', { name: 'Sobre' })).toHaveAttribute('href', '/about');
    });
  });
});
