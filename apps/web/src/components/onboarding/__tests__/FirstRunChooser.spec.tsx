import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

import { FirstRunChooser } from '../FirstRunChooser';

describe('FirstRunChooser', () => {
  it('matches r3-first-run-phone copy and order', () => {
    render(<FirstRunChooser />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Como você quer começar?');
    const links = screen.getAllByRole('link');
    expect(links.map((link) => link.textContent?.replace('›', '').trim())).toEqual([
      'Comprei um deck prontoArmory Deck, Blitz Deck ou Silver Age, na caixa',
      'Tem um link ou uma lista? Colar aqui',
      'Enviar uma planilha (.csv)',
      'Fotografar ou digitar as cartas',
      'Pular por agora',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/add-cards/product',
      '/add-cards',
      '/add-cards/csv',
      '/add-cards/scan',
      '/home',
    ]);
  });

  it('draws the ready-made deck first and larger than the other rows', () => {
    render(<FirstRunChooser />);
    const [lead, paste] = screen.getAllByRole('link');
    expect(lead!.className).toContain('lead');
    expect(paste!.className).not.toContain('lead');
  });
});
