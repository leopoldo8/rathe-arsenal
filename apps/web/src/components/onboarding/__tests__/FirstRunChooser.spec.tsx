import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

import { FirstRunChooser } from '../FirstRunChooser';
import { ToastProvider } from '../../ui/Toast/ToastProvider';
import { makeAuth, renderWithAuth } from '../../auth/__tests__/accountTestKit';

const CONFIRM_LINE = 'Confirme bia.souza@gmail.com para criar links de compartilhar · Reenviar · Errei o e-mail';

function renderAs(emailConfirmed: boolean): void {
  const user = { id: 'u1', email: 'bia.souza@gmail.com', role: 'user' as const, chatAccess: false, emailConfirmed };
  renderWithAuth(
    <ToastProvider>
      <FirstRunChooser />
    </ToastProvider>,
    makeAuth({ user }),
  );
}

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

  it('matches r3-home-unconfirmed-phone: the confirm line sits directly above the heading', () => {
    renderAs(false);

    const line = screen.getByText((_, element) => element?.tagName === 'P' && element.textContent === CONFIRM_LINE);
    expect(within(line).getByRole('button', { name: 'Reenviar' })).toBeInTheDocument();
    expect(within(line).getByRole('button', { name: 'Errei o e-mail' })).toBeInTheDocument();
    const heading = screen.getByRole('heading', { level: 1, name: 'Como você quer começar?' });
    expect(line.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(heading.previousElementSibling).toBe(line);
  });

  it('shows no confirm line once the e-mail is confirmed', () => {
    renderAs(true);

    expect(screen.queryByText(/Confirme bia.souza@gmail.com/)).not.toBeInTheDocument();
  });
});
