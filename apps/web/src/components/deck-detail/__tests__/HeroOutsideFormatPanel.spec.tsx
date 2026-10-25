import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../ui/Toast/ToastProvider';
import type { IDeckDetailResponse } from '../../../api/deck-detail';
import { setTestLocale } from '../../../test/i18n-test-utils';
import { createDeckServer, deckFetch, DeckPageHarness } from './deckPageKit';
import { CLASSIC_PROBLEMS, HERO_NAME, KAYO_HERO, classicLegality, retiredHeroDeck } from './retiredHeroFixture';

const apiFetch = vi.hoisted(() => ({ current: vi.fn() }));
vi.mock('../../../lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api-client')>();
  return { ...actual, useApiClient: () => (path: string, init?: RequestInit) => apiFetch.current(path, init) };
});
vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'a@b.com', role: 'user', chatAccess: false } }),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => vi.fn(),
}));
vi.mock('../TagChipRow', () => ({ TagChipRow: () => <div data-testid="tag-row" /> }));
vi.mock('../DeckAnalysisRow', () => ({ DeckAnalysisRow: () => <div data-testid="analysis-row" /> }));
vi.mock('../recommendations/RecommendationsRail', () => ({ RecommendationsRail: () => <section /> }));

import { HeroOutsideFormatPanel } from '../HeroOutsideFormatPanel';

const LIVING_LEGEND_VALID = { format: 'Living Legend', category: 'legal' as const, details: [] };
const HERO_NOT_LEGAL_ELSEWHERE = (format: string) => ({
  format,
  category: 'illegal' as const,
  details: [{ code: 'hero_not_legal', params: { hero: HERO_NAME, format, allowedFormats: ['Living Legend'] } }],
});

function renderWithProviders(ui: React.ReactElement): ReturnType<typeof render> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>,
  );
}

function textOrder(...texts: readonly string[]): readonly number[] {
  const body = document.body.textContent ?? '';
  return texts.map((text) => body.indexOf(text));
}

describe('HeroOutsideFormatPanel', () => {
  beforeEach(async () => {
    await setTestLocale('pt-BR');
    apiFetch.current = vi.fn();
  });

  it('matches r2-retired-hero-desktop', () => {
    renderWithProviders(
      <HeroOutsideFormatPanel
        deckId={1}
        format="Classic Constructed"
        legality={classicLegality()}
        otherFormats={[HERO_NOT_LEGAL_ELSEWHERE('Blitz'), LIVING_LEGEND_VALID, HERO_NOT_LEGAL_ELSEWHERE('Silver Age')]}
      />,
    );

    const lines = [
      'Este deck não vale no Classic Constructed',
      'Kayo, Armed and Dangerous não é permitido em Classic Constructed. É permitido em Living Legend.',
      'Mandible Claw está banida no Classic Constructed.',
      'Em Living Legend este deck é válido: o herói e a Mandible Claw são permitidos lá.',
      'Mudar para Living Legend',
      'As cartas do deck não mudam, só o formato em que ele é conferido.',
    ];
    for (const line of lines) expect(screen.getByText(line)).toBeInTheDocument();
    const positions = textOrder(...lines);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    expect(screen.getAllByRole('button', { name: /^Mudar para/ })).toHaveLength(1);
    expect(screen.queryByText(/Em Blitz/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Em Silver Age/)).not.toBeInTheDocument();
  });

  it('no valid format offers no switch', () => {
    renderWithProviders(
      <HeroOutsideFormatPanel
        deckId={1}
        format="Classic Constructed"
        legality={classicLegality()}
        otherFormats={[
          HERO_NOT_LEGAL_ELSEWHERE('Blitz'),
          {
            format: 'Living Legend',
            category: 'illegal',
            details: [
              { code: 'card_banned', params: { card: 'Snatch', cardIdentifier: 'snatch-red', format: 'Living Legend' } },
            ],
          },
          HERO_NOT_LEGAL_ELSEWHERE('Silver Age'),
        ]}
      />,
    );

    expect(screen.queryByRole('button', { name: /^Mudar para/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/As cartas do deck não mudam/)).not.toBeInTheDocument();
    for (const format of ['Blitz', 'Living Legend', 'Silver Age']) {
      const group = screen.getByRole('group', { name: `Em ${format}` });
      expect(within(group).getAllByRole('listitem').length).toBeGreaterThan(0);
    }
    expect(screen.getByText('Snatch está banida no Living Legend.')).toBeInTheDocument();
    expect(screen.getByText(`${HERO_NAME} não é permitido em Blitz. É permitido em Living Legend.`)).toBeInTheDocument();
  });

  it('shows nothing for a deck whose hero plays its format', () => {
    renderWithProviders(
      <HeroOutsideFormatPanel
        deckId={1}
        format="Classic Constructed"
        legality={{ category: 'illegal', reasons: [], details: CLASSIC_PROBLEMS.slice(1) }}
        otherFormats={[LIVING_LEGEND_VALID]}
      />,
    );

    expect(screen.queryByText(/Este deck não vale/)).not.toBeInTheDocument();
  });

  it('the switch changes the format with undo', async () => {
    const server = createDeckServer(retiredHeroDeck(), [KAYO_HERO]);
    server.handlers.set('PATCH /decks/1', (body) => {
      const { format } = body as { format: string };
      const livingLegend = format === 'Living Legend';
      server.deck = {
        ...server.deck,
        format,
        legality: livingLegend ? { category: 'legal', reasons: [], details: [] } : classicLegality(),
      } as IDeckDetailResponse;
      return undefined;
    });
    apiFetch.current = deckFetch(server);
    renderWithProviders(<DeckPageHarness deckId={1} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Mudar para Living Legend' }));

    await waitFor(() => expect(screen.getByTestId('deck-hero-eyebrow')).toHaveTextContent('Living Legend'));
    expect(server.calls.filter((call) => call.method === 'PATCH')).toEqual([
      { method: 'PATCH', path: '/decks/1', body: { format: 'Living Legend' } },
    ]);
    expect(await screen.findByText('Este deck vale em Living Legend.')).toBeInTheDocument();
    expect(screen.queryByText('Este deck não vale no Classic Constructed')).not.toBeInTheDocument();
    const toast = screen.getByText('Formato mudado para Living Legend');
    expect(toast).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));

    await waitFor(() => expect(screen.getByTestId('deck-hero-eyebrow')).toHaveTextContent('Classic Constructed'));
    expect(server.calls.filter((call) => call.method === 'PATCH').at(-1)).toEqual({
      method: 'PATCH',
      path: '/decks/1',
      body: { format: 'Classic Constructed' },
    });
    expect(await screen.findByText('Este deck não vale no Classic Constructed')).toBeInTheDocument();
    expect(screen.queryByText('Este deck vale em Living Legend.')).not.toBeInTheDocument();
  });
});
