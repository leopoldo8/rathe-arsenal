import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { withLinkMock } from '../../test/router-link-mock';

const routerState = vi.hoisted(() => ({
  location: { state: {} as Record<string, unknown>, hash: '' },
}));
const authState = vi.hoisted(() => ({ user: null as { id: string } | null }));

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...withLinkMock(await importOriginal<object>()),
  createFileRoute: () => (config: object) => config,
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) => select({ location: routerState.location }),
}));
vi.mock('../../auth/useAuth', () => ({ useAuth: () => ({ user: authState.user }) }));

import { TermosPage } from '../termos';

const SORTED_WORDS = (words: readonly string[]): readonly string[] => [...words].sort((a, b) => a.localeCompare(b, 'pt-BR'));

function words(): string[] {
  return screen.getAllByTestId('glossary-entry').map((entry) => entry.querySelector('dt')?.textContent ?? '');
}

describe('/termos', () => {
  beforeEach(() => {
    routerState.location = { state: {}, hash: '' };
    authState.user = null;
  });

  it('lists every word in Portuguese alphabetical order', () => {
    render(<TermosPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Termos do jogo' })).toBeInTheDocument();
    expect(screen.getByText('O que querem dizer as palavras do jogo.')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Procurar uma palavra' })).toBeInTheDocument();
    const listed = words();
    expect(listed).toHaveLength(31);
    expect(listed[0]).toBe('Ação');
    expect(listed[listed.length - 1]).toBe('Vermelho, Amarelo, Azul');
    expect(listed).toEqual(SORTED_WORDS(listed));
    const first = screen.getAllByTestId('glossary-entry')[0] as HTMLElement;
    expect(first.querySelector('dd')?.textContent).toBe(
      'Carta que você joga na sua vez, gastando a sua ação. Muitas ações são ataques.',
    );
  });

  it('a search with no match says so and keeps the list', async () => {
    render(<TermosPage />);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Procurar uma palavra' }), 'xyz');

    expect(screen.getByRole('status')).toHaveTextContent('Nenhuma palavra com "xyz". Veja a lista completa abaixo.');
    expect(words()).toHaveLength(31);
  });

  it('a search that matches narrows the list and finds a word through its sentence', async () => {
    render(<TermosPage />);

    await userEvent.type(screen.getByRole('searchbox', { name: 'Procurar uma palavra' }), 'acao');

    expect(screen.queryByTestId('glossary-no-match')).toBeNull();
    expect(words()).toContain('Ação');
    expect(words().length).toBeLessThan(31);
  });

  it('the q parameter fills the search', () => {
    render(<TermosPage initialQuery="Blitz" />);

    expect(screen.getByRole('searchbox', { name: 'Procurar uma palavra' })).toHaveValue('Blitz');
    expect(words()).toContain('Blitz');
  });

  it('opens scrolled to the word of the address hash', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    routerState.location = { state: {}, hash: 'pitch' };

    render(<TermosPage />);

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById('pitch'));
  });

  it('goes back to where the player came from, and home or the start when nothing says', () => {
    routerState.location = { state: { glossaryFrom: { path: '/decks/7' } }, hash: '' };
    const { unmount } = render(<TermosPage />);
    expect(screen.getByTestId('glossary-back')).toHaveAttribute('href', '/decks/7');
    expect(screen.queryByTestId('glossary-back-to-list')).toBeNull();
    unmount();

    routerState.location = { state: {}, hash: '' };
    authState.user = { id: '1' };
    const signedIn = render(<TermosPage />);
    expect(screen.getByTestId('glossary-back')).toHaveAttribute('href', '/home');
    signedIn.unmount();

    authState.user = null;
    render(<TermosPage />);
    expect(screen.getByTestId('glossary-back')).toHaveAttribute('href', '/');
  });

  it('ignores an origin that is not a path inside the app', () => {
    routerState.location = { state: { glossaryFrom: { path: 'https://example.com/x', label: 'Voltar' } }, hash: '' };

    render(<TermosPage />);

    expect(screen.getByTestId('glossary-back')).toHaveAttribute('href', '/');
    expect(screen.queryByTestId('glossary-back-to-list')).toBeNull();
  });

  it('matches r2-glossary-phone', () => {
    routerState.location = {
      state: { glossaryFrom: { path: '/l/abc', label: 'Voltar para a lista do Pedro' } },
      hash: '',
    };
    render(<TermosPage />);

    const signIn = screen.getByRole('link', { name: 'Entrar' });
    const back = screen.getByTestId('glossary-back');
    const title = screen.getByRole('heading', { level: 1, name: 'Termos do jogo' });
    const lead = screen.getByText('O que querem dizer as palavras do jogo.');
    const search = screen.getByRole('searchbox', { name: 'Procurar uma palavra' });
    const toList = screen.getByRole('link', { name: 'Voltar para a lista do Pedro' });
    const entries = screen.getAllByTestId('glossary-entry');
    const notice = screen.getByText(/Legend Story Studios/);
    const about = screen.getByRole('link', { name: 'Sobre' });

    expect(back).toHaveTextContent('‹ Voltar');
    expect(toList).toHaveAttribute('href', '/l/abc');
    expect(entries).toHaveLength(31);
    const inOrder: HTMLElement[] = [signIn, back, title, lead, search, toList, entries[0] as HTMLElement, entries[30] as HTMLElement, notice, about];
    for (let index = 1; index < inOrder.length; index += 1) {
      const before = inOrder[index - 1] as HTMLElement;
      const after = inOrder[index] as HTMLElement;
      expect(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING, `${index}`).toBeTruthy();
    }
    expect(within(screen.getByRole('banner')).queryByRole('link', { name: 'Criar conta' })).toBeNull();
  });
});
