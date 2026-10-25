import React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { mockNavigate, importMutate, scratchMutateHolder } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  importMutate: vi.fn(),
  scratchMutateHolder: { fn: vi.fn(), isPending: false },
}));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: (_path: string) => (_config: unknown) => ({
    useSearch: () => ({}),
  }),
  useNavigate: () => mockNavigate,
  Link: ({ children, to, className, ...rest }: { children: React.ReactNode; to: string; className?: string }) => (
    <a href={to} className={className} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock('../../../api/decks', () => ({
  useImportDecksMutation: () => ({ mutate: importMutate, isPending: false }),
  useCreateScratchDeckMutation: () => ({ mutate: scratchMutateHolder.fn, isPending: scratchMutateHolder.isPending }),
}));

function art(name: string): { small: string; large: string; sources: [] } {
  return { small: `/art/${name}-small.webp`, large: `/art/${name}-large.webp`, sources: [] };
}

const HEROES = [
  {
    cardIdentifier: 'rhinar',
    name: 'Rhinar',
    hero: 'Rhinar',
    young: true,
    legalFormats: ['Blitz', 'Draft', 'Open', 'Silver Age', 'Ultimate Pit Fight'],
    imageUrl: art('rhinar'),
  },
  {
    cardIdentifier: 'rhinar-reckless-rampage',
    name: 'Rhinar, Reckless Rampage',
    hero: 'Rhinar',
    young: false,
    legalFormats: ['Classic Constructed', 'Golden Age', 'Living Legend', 'Open'],
    imageUrl: art('rhinar-adult'),
  },
  {
    cardIdentifier: 'dorinthea-ironsong',
    name: 'Dorinthea Ironsong',
    hero: 'Dorinthea',
    young: false,
    legalFormats: ['Classic Constructed', 'Open'],
    imageUrl: art('dorinthea'),
  },
  {
    cardIdentifier: 'open-only-hero',
    name: 'Rhinar Open Only',
    hero: 'Rhinar',
    young: false,
    legalFormats: ['Open'],
    imageUrl: null,
  },
];

vi.mock('../../../api/catalog', () => ({
  useHeroesQuery: () => ({ data: { heroes: HEROES }, isLoading: false, isFetching: false }),
  HEROES_QUERY_KEY: ['catalog-heroes'],
}));

import { DecksNewPage } from '../decks.new';

function renderPage(): ReturnType<typeof render> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DecksNewPage />
    </QueryClientProvider>,
  );
}

async function openScratch(): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name: /^Começar do zero/ }));
}

async function searchHero(query: string): Promise<void> {
  await openScratch();
  await userEvent.type(screen.getByRole('searchbox'), query);
}

async function pickHero(name: RegExp | string): Promise<void> {
  await userEvent.click(screen.getByRole('button', { name }));
}

function orderOf(...texts: readonly string[]): readonly number[] {
  const body = document.body.textContent ?? '';
  return texts.map((text) => body.indexOf(text));
}

describe('DecksNewPage', () => {
  beforeEach(() => {
    importMutate.mockReset();
    mockNavigate.mockReset();
    scratchMutateHolder.fn = vi.fn();
    scratchMutateHolder.isPending = false;
  });

  it('the ready-made row opens the search of the boxes', () => {
    renderPage();

    expect(screen.getByRole('link', { name: /Comprei um deck pronto/ })).toHaveAttribute('href', '/add-cards/product');
  });

  it('three ways to start a deck', () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Novo deck' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Comprei um deck pronto/ })).toBeInTheDocument();
    const fabrary = screen.getByRole('button', { name: /Tenho um link do Fabrary/ });
    const scratch = screen.getByRole('button', { name: /Começar do zero/ });
    expect(fabrary).toHaveAttribute('aria-expanded', 'false');
    expect(scratch).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Link do deck no Fabrary/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Voltar para os decks/ })).toHaveAttribute('href', '/home');
  });

  it('matches r2-new-deck-hero-phone', async () => {
    renderPage();

    await searchHero('rhinar');

    const young = screen.getByRole('button', { name: /Rhinar · jovem/ });
    const adult = screen.getByRole('button', { name: /Rhinar, Reckless Rampage/ });
    expect(within(young).getByText('Blitz')).toBeInTheDocument();
    expect(within(young).getByText('Silver Age')).toBeInTheDocument();
    expect(within(young).queryByText('Open')).not.toBeInTheDocument();
    expect(within(young).queryByText('Draft')).not.toBeInTheDocument();
    expect(within(adult).getByText('Classic Constructed')).toBeInTheDocument();
    expect(within(adult).getByText('Living Legend')).toBeInTheDocument();
    expect(within(adult).queryByText('Golden Age')).not.toBeInTheDocument();
    expect(young.querySelector('img')).toHaveAttribute('src', '/art/rhinar-small.webp');
    expect(adult.querySelector('img')).toHaveAttribute('src', '/art/rhinar-adult-small.webp');
    expect(document.querySelector('[aria-selected="true"], [aria-current], [data-active="true"]')).toBeNull();
    expect(screen.getAllByText('Herói jovem: versão para Blitz e Silver Age, decks de 40 cartas.')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Dorinthea/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Open Only/ })).not.toBeInTheDocument();
    expect(orderOf('Rhinar · jovem', 'Rhinar, Reckless Rampage').every((at) => at >= 0)).toBe(true);
  });

  it('matches r2-new-deck-format-phone', async () => {
    renderPage();
    await searchHero('rhinar');

    await pickHero(/Rhinar · jovem/);

    expect(screen.getByRole('button', { name: '‹ Escolher outro herói' })).toBeInTheDocument();
    expect(screen.getByText('Você escolheu Rhinar')).toBeInTheDocument();
    expect(screen.getByText('Herói jovem')).toBeInTheDocument();
    expect(screen.getByText('Formato')).toBeInTheDocument();
    expect(screen.getByText('Blitz: 40 cartas, 1 cópia de cada')).toBeInTheDocument();
    expect(
      screen.getByText('Silver Age: 40 cartas, até 2 cópias, só cartas que já saíram como comum ou rara'),
    ).toBeInTheDocument();
    const formats = screen.getAllByRole('radio');
    expect(formats.map((radio) => radio.getAttribute('value'))).toEqual(['Blitz', 'Silver Age']);
    expect(formats.every((radio) => !(radio as HTMLInputElement).checked)).toBe(true);
    const start = screen.getByRole('button', { name: 'Começar a montar' });
    expect(start).toBeDisabled();
    expect(
      orderOf('‹ Escolher outro herói', 'Você escolheu Rhinar', 'Herói jovem', 'Formato', 'Blitz: 40', 'Silver Age: 40').every(
        (at, index, all) => at >= 0 && (index === 0 || at > all[index - 1]!),
      ),
    ).toBe(true);

    await userEvent.click(formats[0]!);

    expect(start).toBeEnabled();
  });

  it('a hero with one format shows it unchecked', async () => {
    renderPage();
    await searchHero('dorinthea');

    await pickHero(/Dorinthea Ironsong/);

    const formats = screen.getAllByRole('radio');
    expect(formats).toHaveLength(1);
    expect((formats[0] as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByText('Herói jovem')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Começar a montar' })).toBeDisabled();
  });

  it('derives the Classic Constructed and Living Legend lines from the rules table', async () => {
    renderPage();
    await searchHero('rhinar');

    await pickHero(/Rhinar, Reckless Rampage/);

    expect(screen.getByText('Classic Constructed: pelo menos 60 cartas, até 3 cópias de cada')).toBeInTheDocument();
    expect(
      screen.getByText('Living Legend: pelo menos 60 cartas, até 3 cópias de cada, e só 1 de uma carta restrita'),
    ).toBeInTheDocument();
  });

  it('going back to the hero search keeps what was typed', async () => {
    renderPage();
    await searchHero('rhinar');
    await pickHero(/Rhinar · jovem/);

    await userEvent.click(screen.getByRole('button', { name: '‹ Escolher outro herói' }));

    expect(screen.getByRole('searchbox')).toHaveValue('rhinar');
  });

  it('creates the deck with the hero and the chosen format and opens the editor', async () => {
    scratchMutateHolder.fn.mockImplementation(
      (_payload: unknown, { onSuccess }: { onSuccess: (result: { id: number }) => void }) => onSuccess({ id: 99 }),
    );
    renderPage();
    await searchHero('rhinar');
    await pickHero(/Rhinar · jovem/);

    await userEvent.click(screen.getByRole('radio', { name: /^Silver Age/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Começar a montar' }));

    expect(scratchMutateHolder.fn).toHaveBeenCalledWith(
      expect.objectContaining({ heroIdentifier: 'rhinar', format: 'Silver Age' }),
      expect.any(Object),
    );
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: '/decks/$deckId', params: { deckId: '99' }, search: { edit: 1 } }),
    );
  });

  it('shows the server error when the deck cannot be created', async () => {
    scratchMutateHolder.fn.mockImplementation(
      (_payload: unknown, { onError }: { onError: (error: Error) => void }) => onError(new Error('Hero not found')),
    );
    renderPage();
    await searchHero('rhinar');
    await pickHero(/Rhinar · jovem/);

    await userEvent.click(screen.getByRole('radio', { name: /^Blitz/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Começar a montar' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Hero not found');
  });

  describe('the Fabrary link row', () => {
    async function openFabrary(): Promise<void> {
      await userEvent.click(screen.getByRole('button', { name: /Tenho um link do Fabrary/ }));
    }

    it('imports a deck from a valid link and opens it', async () => {
      importMutate.mockImplementation(
        (_payload: unknown, { onSuccess }: { onSuccess: (result: unknown) => void }) =>
          onSuccess({ imported: [{ trackedDeckId: 42 }], errors: [], skipped: [] }),
      );
      renderPage();
      await openFabrary();

      fireEvent.change(screen.getByLabelText(/Link do deck no Fabrary/i), {
        target: { value: 'https://fabrary.net/decks/01HABCDEFG12345' },
      });
      await userEvent.click(screen.getByRole('button', { name: /importar deck/i }));

      expect(importMutate).toHaveBeenCalledWith(
        expect.objectContaining({ urls: ['https://fabrary.net/decks/01HABCDEFG12345'] }),
        expect.any(Object),
      );
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ to: '/decks/$deckId', params: { deckId: '42' }, search: { edit: undefined } }),
      );
    });

    it('refuses a link that is not a Fabrary deck without calling the server', async () => {
      renderPage();
      await openFabrary();

      await userEvent.type(screen.getByLabelText(/Link do deck no Fabrary/i), 'not-a-url');
      await userEvent.click(screen.getByRole('button', { name: /importar deck/i }));

      expect(importMutate).not.toHaveBeenCalled();
      expect(screen.getByText(/Esse não é um link de deck do Fabrary/i)).toBeInTheDocument();
    });

    it('shows the error the import answers with', async () => {
      importMutate.mockImplementation(
        (_payload: unknown, { onError }: { onError: (error: Error) => void }) => onError(new Error('Server unavailable')),
      );
      renderPage();
      await openFabrary();

      fireEvent.change(screen.getByLabelText(/Link do deck no Fabrary/i), {
        target: { value: 'https://fabrary.net/decks/01HABCDEFG12345' },
      });
      await userEvent.click(screen.getByRole('button', { name: /importar deck/i }));

      expect(screen.getByText(/Server unavailable/i)).toBeInTheDocument();
    });

    it('does not opt into inventory seeding', async () => {
      renderPage();
      await openFabrary();

      fireEvent.change(screen.getByLabelText(/Link do deck no Fabrary/i), {
        target: { value: 'https://fabrary.net/decks/01HABCDEFG12345' },
      });
      await userEvent.click(screen.getByRole('button', { name: /importar deck/i }));

      const [payload] = importMutate.mock.calls[0] as [{ seedInventory?: boolean }];
      expect(payload.seedInventory).not.toBe(true);
    });
  });
});
