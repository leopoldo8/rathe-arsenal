import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ISharedCard, ISharedDeckResponse } from '../../../api/shared-decks';
import { SHARE_RETURN_STORAGE_KEY } from '../../../lib/share-return';
import {
  apiError,
  createFakeApi,
  makeAuth,
  renderWithProviders,
  type IFakeApi,
} from './sharingTestKit';

const apiRef = vi.hoisted(() => ({ current: null as IFakeApi | null }));
const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('../../../lib/auth-fetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/auth-fetch')>();
  return {
    ...actual,
    authFetch: (...args: Parameters<IFakeApi['authFetch']>) => apiRef.current!.authFetch(...args),
  };
});

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    className,
    onClick,
  }: {
    children: React.ReactNode;
    to: string;
    className?: string;
    onClick?: () => void;
  }) => (
    <a
      href={to}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        onClick?.();
      }}
    >
      {children}
    </a>
  ),
  useNavigate: () => navigateMock,
}));

import { SharedDeckPage } from '../SharedDeckPage';

const TOKEN = 'k7QxN2mTp9aV4wLcAbCdEf';
const URL = `https://rathearsenal.app/d/${TOKEN}`;

function card(overrides: Partial<ISharedCard>): ISharedCard {
  return {
    cardIdentifier: 'id',
    name: 'Card',
    pitch: null,
    type: 'Action - Attack',
    slot: 'mainboard',
    quantity: 1,
    imageUrl: null,
    ...overrides,
  };
}

const MISSING: ISharedCard[] = [
  card({ cardIdentifier: 'gauntlet', name: 'Goliath Gauntlet', slot: 'equipment', type: 'Equipment', quantity: 1 }),
  card({ cardIdentifier: 'pack-hunt-red', name: 'Pack Hunt', pitch: 1, quantity: 2 }),
];

const DECK: ISharedDeckResponse = {
  intent: 'deck',
  token: TOKEN,
  url: URL,
  name: 'Rhinar Rampage',
  hero: 'Rhinar, Reckless Rampage',
  heroIdentifier: 'rhinar-reckless-rampage',
  heroCard: null,
  format: 'Classic Constructed',
  sharerName: 'Dudu_Pelotas',
  isOwner: false,
  updatedAt: '2026-10-18T12:00:00Z',
  totalCards: 8,
  cards: [
    card({ cardIdentifier: 'rhinar', name: 'Rhinar, Reckless Rampage', slot: 'hero', type: 'Hero', quantity: 1 }),
    card({ cardIdentifier: 'club', name: 'Romping Club', slot: 'weapon', type: 'Weapon', quantity: 1 }),
    ...MISSING,
    card({ cardIdentifier: 'swing-red', name: 'Reckless Swing', pitch: 1, type: 'Attack Reaction', quantity: 3 }),
  ],
  missing: [],
  missingCount: 0,
  contactWhatsapp: null,
  deckId: null,
};

const MISSING_TOKEN = 'mQ8rZ3nUp2bX5yKdFgHjLs';
const WANTED: ISharedDeckResponse = {
  ...DECK,
  intent: 'missing',
  token: MISSING_TOKEN,
  url: `https://rathearsenal.app/d/${MISSING_TOKEN}`,
  cards: [],
  missing: MISSING,
  missingCount: 3,
};

function renderPage(_unused: undefined = undefined, auth = makeAuth({ user: null, token: null }), token = TOKEN) {
  renderWithProviders(<SharedDeckPage token={token} />, auth);
}

describe('SharedDeckPage', () => {
  let api: IFakeApi;

  beforeEach(() => {
    api = createFakeApi();
    apiRef.current = api;
    api.handlers.set(`GET /shared/decks/${TOKEN}`, () => DECK);
    navigateMock.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('shows a loading state before the deck arrives', async () => {
    api.handlers.set(`GET /shared/decks/${TOKEN}`, () => new Promise(() => undefined));
    renderPage();
    expect(await screen.findByTestId('shared-deck-loading')).toBeInTheDocument();
  });

  describe('deck', () => {
    it('shows name, hero, format, sharer, grouped cards and the disclaimer with its copyright once', async () => {
      renderPage();

      expect(await screen.findByRole('heading', { level: 1, name: 'Rhinar Rampage' })).toBeInTheDocument();
      expect(screen.getByText('Classic Constructed')).toBeInTheDocument();
      expect(screen.getByText('Herói: Rhinar, Reckless Rampage')).toBeInTheDocument();
      expect(screen.getByText('Dudu_Pelotas')).toBeInTheDocument();
      expect(screen.getByTestId('shared-group-hero')).toBeInTheDocument();
      expect(screen.getByTestId('shared-group-weapon')).toHaveTextContent('Romping Club');
      expect(screen.getByTestId('shared-group-equipment')).toHaveTextContent('Goliath Gauntlet');
      expect(screen.getByTestId('shared-group-actions')).toHaveTextContent('Pack Hunt');
      expect(screen.getByTestId('shared-group-reactions')).toHaveTextContent('Reckless Swing');
      const footer = screen.getByTestId('shared-deck-footer');
      expect(footer).toHaveTextContent('Legend Story Studios®');
      expect(footer.textContent?.match(/© Legend Story Studios/g)).toHaveLength(1);
    });

    it('loads the deck without a Bearer token when anonymous', async () => {
      renderPage();
      await screen.findByRole('heading', { level: 1 });
      expect(api.calls).toEqual([{ key: `GET /shared/decks/${TOKEN}`, body: undefined, authToken: null }]);
    });

    it('sends the Bearer token when the visitor is logged in', async () => {
      api.handlers.set(`GET /shared/decks/${TOKEN}/coverage`, () => ({ ownedCopies: 1, totalCopies: 8, percent: 13 }));
      renderPage(undefined, makeAuth());
      await screen.findByRole('heading', { level: 1 });
      expect(api.calls[0]).toEqual({ key: `GET /shared/decks/${TOKEN}`, body: undefined, authToken: 'jwt' });
    });

    it('records one open only: focusing the window does not reload the deck', async () => {
      renderPage();
      await screen.findByRole('heading', { level: 1 });
      act(() => {
        window.dispatchEvent(new Event('focus'));
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(api.calls.filter((call) => call.key === `GET /shared/decks/${TOKEN}`)).toHaveLength(1);
    });
  });

  describe('anonymous visitor', () => {
    it('is invited to sign up or sign in, with no coverage request', async () => {
      renderPage();

      const invite = await screen.findByTestId('shared-invite');
      expect(within(invite).getByText('Quanto deste deck você já tem?')).toBeInTheDocument();
      expect(within(invite).getByRole('link', { name: 'Criar conta' })).toHaveAttribute('href', '/sign-up');
      expect(within(invite).getByRole('link', { name: 'Já tenho conta' })).toHaveAttribute('href', '/sign-in');
      expect(api.calls.some((call) => call.key.includes('/coverage'))).toBe(false);
    });

    it('remembers the shared page before heading to sign-up', async () => {
      renderPage();
      const invite = await screen.findByTestId('shared-invite');

      await userEvent.click(within(invite).getByRole('link', { name: 'Criar conta' }));

      expect(JSON.parse(localStorage.getItem(SHARE_RETURN_STORAGE_KEY) ?? 'null')).toEqual({
        returnTo: `/d/${TOKEN}`,
        shareToken: TOKEN,
        savedAt: expect.any(Number),
      });
    });

    it('remembers the shared page before heading to sign-in', async () => {
      renderPage();
      const invite = await screen.findByTestId('shared-invite');

      await userEvent.click(within(invite).getByRole('link', { name: 'Já tenho conta' }));

      expect(localStorage.getItem(SHARE_RETURN_STORAGE_KEY)).toContain(TOKEN);
    });
  });

  describe('logged-in visitor', () => {
    beforeEach(() => {
      api.handlers.set(`GET /shared/decks/${TOKEN}/coverage`, () => ({ ownedCopies: 6, totalCopies: 8, percent: 75 }));
    });

    it('shows exact coverage as owned of total and percent', async () => {
      renderPage(undefined, makeAuth());

      const panel = await screen.findByTestId('shared-coverage');
      expect(await within(panel).findByText('75')).toBeInTheDocument();
      expect(within(panel).getByText('6 de 8')).toBeInTheDocument();
      expect(within(panel).getByText('Faltam 2 cópias.')).toBeInTheDocument();
      expect(screen.queryByTestId('shared-invite')).not.toBeInTheDocument();
    });

    it('copies the deck and opens the new one', async () => {
      api.handlers.set(`POST /shared/decks/${TOKEN}/copy`, () => ({ deckId: 42 }));
      renderPage(undefined, makeAuth());

      await userEvent.click(await screen.findByRole('button', { name: 'Copiar para meus decks' }));

      await waitFor(() =>
        expect(navigateMock).toHaveBeenCalledWith({
          to: '/decks/$deckId',
          params: { deckId: '42' },
          search: { edit: undefined },
        }),
      );
      expect(api.calls.find((call) => call.key.startsWith('POST'))?.authToken).toBe('jwt');
    });

    it('shows the localized error when the link died before copying', async () => {
      api.handlers.set(`POST /shared/decks/${TOKEN}/copy`, () => {
        throw apiError(404, 'SHARE_LINK_UNAVAILABLE');
      });
      renderPage(undefined, makeAuth());

      await userEvent.click(await screen.findByRole('button', { name: 'Copiar para meus decks' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Este link não está mais disponível.');
      expect(navigateMock).not.toHaveBeenCalled();
    });
  });

  describe('owner', () => {
    it('sees a note instead of the comparison and the copy button, and no coverage request', async () => {
      api.handlers.set(`GET /shared/decks/${TOKEN}`, () => ({ ...DECK, isOwner: true }));
      renderPage(undefined, makeAuth());

      expect(await screen.findByTestId('shared-owner-note')).toHaveTextContent('Este é o seu link');
      expect(screen.queryByRole('button', { name: 'Copiar para meus decks' })).not.toBeInTheDocument();
      expect(screen.queryByTestId('shared-invite')).not.toBeInTheDocument();
      expect(api.calls.some((call) => call.key.includes('/coverage'))).toBe(false);
    });

    it('gets a link back to the deck', async () => {
      api.handlers.set(`GET /shared/decks/${TOKEN}`, () => ({ ...DECK, isOwner: true, deckId: 7 }));
      renderPage(undefined, makeAuth());
      expect(await screen.findByRole('link', { name: 'Abrir o deck' })).toBeInTheDocument();
    });

    it('has no manage link when the API sends no deck id', async () => {
      api.handlers.set(`GET /shared/decks/${TOKEN}`, () => ({ ...DECK, isOwner: true }));
      renderPage(undefined, makeAuth());
      await screen.findByTestId('shared-owner-note');
      expect(screen.queryByRole('link', { name: 'Abrir o deck' })).not.toBeInTheDocument();
    });
  });

  describe('WhatsApp contact', () => {
    const WA_URL =
      'https://wa.me/5553999990000?text=Oi!%20Vi%20seu%20deck%20Rhinar%20Rampage%20no%20Rathe%20Arsenal.';

    it('shows the pill and the fixed bar, both opening wa.me with the ready message', async () => {
      api.handlers.set(`GET /shared/decks/${TOKEN}`, () => ({ ...DECK, contactWhatsapp: '5553999990000' }));
      renderPage();

      const pill = await screen.findByTestId('shared-contact-pill');
      expect(pill).toHaveAttribute('href', WA_URL);
      expect(pill).toHaveAttribute('aria-label', 'Chamar Dudu_Pelotas no WhatsApp');
      const bar = screen.getByTestId('shared-contact-bar');
      expect(within(bar).getByRole('link', { name: 'Chamar Dudu_Pelotas no WhatsApp' })).toHaveAttribute('href', WA_URL);
    });

    it('is also offered to a logged-in visitor', async () => {
      api.handlers.set(`GET /shared/decks/${TOKEN}`, () => ({ ...DECK, contactWhatsapp: '5553999990000' }));
      api.handlers.set(`GET /shared/decks/${TOKEN}/coverage`, () => ({ ownedCopies: 1, totalCopies: 8, percent: 13 }));
      renderPage(undefined, makeAuth());
      expect(await screen.findByTestId('shared-contact-pill')).toBeInTheDocument();
    });

    it('is absent when the link shows no contact', async () => {
      renderPage();
      await screen.findByRole('heading', { level: 1 });
      expect(screen.queryByTestId('shared-contact-pill')).not.toBeInTheDocument();
      expect(screen.queryByTestId('shared-contact-bar')).not.toBeInTheDocument();
    });

    it('is absent on an unavailable link', async () => {
      api.handlers.set(`GET /shared/decks/${TOKEN}`, () => {
        throw apiError(404, 'SHARE_LINK_UNAVAILABLE');
      });
      renderPage();
      await screen.findByTestId('shared-unavailable');
      expect(screen.queryByTestId('shared-contact-bar')).not.toBeInTheDocument();
    });

    it('speaks English to an English visitor', async () => {
      await (await import('../../../test/i18n-test-utils')).setTestLocale('en-US');
      api.handlers.set(`GET /shared/decks/${TOKEN}`, () => ({ ...DECK, contactWhatsapp: '5553999990000' }));
      renderPage();
      expect(await screen.findByTestId('shared-contact-pill')).toHaveAttribute(
        'href',
        'https://wa.me/5553999990000?text=Hi!%20I%20saw%20your%20deck%20Rhinar%20Rampage%20on%20Rathe%20Arsenal.',
      );
    });
  });

  describe('missing-cards link', () => {
    const wantedKey = `GET /shared/decks/${MISSING_TOKEN}`;

    beforeEach(() => {
      api.handlers.set(wantedKey, () => WANTED);
    });

    it('shows the "looking for" header and only the missing cards, with no deck comparison', async () => {
      renderPage(undefined, undefined, MISSING_TOKEN);

      expect(await screen.findByText('Procuro cartas')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Rhinar Rampage' })).toBeInTheDocument();
      expect(screen.getByText('Faltam 3 cartas')).toBeInTheDocument();
      const cards = screen.getAllByTestId('shared-card');
      expect(cards).toHaveLength(2);
      expect(screen.queryByTestId('shared-invite')).not.toBeInTheDocument();
      expect(screen.queryByTestId('shared-deck-list')).not.toBeInTheDocument();
      expect(screen.queryByText('Reckless Swing')).not.toBeInTheDocument();
    });

    it('copies the list as text with the address', async () => {
      const user = userEvent.setup();
      const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
      renderPage(undefined, undefined, MISSING_TOKEN);

      await user.click(await screen.findByRole('button', { name: 'Copiar lista' }));

      expect(writeText).toHaveBeenCalledWith(
        `1x Goliath Gauntlet\n2x Pack Hunt (Vermelho)\n\nhttps://rathearsenal.app/d/${MISSING_TOKEN}`,
      );
      expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
    });

    it('offers WhatsApp as the main action with the missing-cards message', async () => {
      api.handlers.set(wantedKey, () => ({ ...WANTED, contactWhatsapp: '5553999990000' }));
      renderPage(undefined, undefined, MISSING_TOKEN);

      const pill = await screen.findByTestId('shared-contact-pill');
      expect(pill.getAttribute('href')).toContain(
        encodeURIComponent('Oi! Tenho cartas que você procura para o deck Rhinar Rampage.'),
      );
    });

    it('invites an anonymous visitor to sign up and makes no matches request', async () => {
      renderPage(undefined, undefined, MISSING_TOKEN);
      expect(await screen.findByTestId('shared-signup-prompt')).toHaveTextContent('Crie uma conta para ver quais você já tem.');
      expect(api.calls.some((call) => call.key.includes('/matches'))).toBe(false);
    });

    it('shows "você tem N" on the cards a logged-in visitor owns', async () => {
      api.handlers.set(`GET /shared/decks/${MISSING_TOKEN}/matches`, () => ({
        cards: [
          { cardIdentifier: 'gauntlet', owned: 0 },
          { cardIdentifier: 'pack-hunt-red', owned: 2 },
        ],
      }));
      renderPage(undefined, makeAuth(), MISSING_TOKEN);

      const owned = await screen.findByTestId('shared-owned');
      expect(owned).toHaveTextContent('você tem 2');
      expect(screen.getAllByTestId('shared-owned')).toHaveLength(1);
      expect(screen.queryByTestId('shared-signup-prompt')).not.toBeInTheDocument();
      expect(api.calls.some((call) => call.key.includes('/coverage') || call.key.includes('/copy'))).toBe(false);
    });

    it('does not ask the owner for matches', async () => {
      api.handlers.set(wantedKey, () => ({ ...WANTED, isOwner: true, deckId: 7 }));
      renderPage(undefined, makeAuth(), MISSING_TOKEN);
      await screen.findByText('Procuro cartas');
      expect(api.calls.some((call) => call.key.includes('/matches'))).toBe(false);
    });

    it('says nothing is missing when the owner has every copy', async () => {
      api.handlers.set(wantedKey, () => ({ ...WANTED, missing: [], missingCount: 0 }));
      renderPage(undefined, undefined, MISSING_TOKEN);
      expect(await screen.findByText('Nada falta neste deck.')).toBeInTheDocument();
    });
  });

  it('deck link has no button to a missing view', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByTestId('shared-open-missing')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('shared-card').length).toBeGreaterThan(0);
  });

  describe('unavailable link', () => {
    beforeEach(() => {
      api.handlers.set(`GET /shared/decks/${TOKEN}`, () => {
        throw apiError(404, 'SHARE_LINK_UNAVAILABLE');
      });
    });

    it('says the link is no longer available, with no deck data and no retry', async () => {
      renderPage();

      expect(await screen.findByText('Este link não está mais disponível.')).toBeInTheDocument();
      expect(screen.queryByTestId('shared-deck-header')).not.toBeInTheDocument();
      expect(screen.queryByTestId('shared-deck-list')).not.toBeInTheDocument();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(api.calls).toHaveLength(1);
    });

    it('does not remember the dead address for sign-in', async () => {
      renderPage();
      await userEvent.click(await screen.findByRole('link', { name: 'Entrar' }));
      expect(localStorage.getItem(SHARE_RETURN_STORAGE_KEY)).toBeNull();
    });
  });

  it('offers a retry when the deck fails to load for another reason', async () => {
    api.handlers.set(`GET /shared/decks/${TOKEN}`, () => {
      throw apiError(500, null);
    });
    renderPage();
    // The query retries a non-404 failure once (about a second later) before giving up.
    expect(await screen.findByRole('button', { name: 'Tentar de novo' }, { timeout: 4000 })).toBeInTheDocument();
  });
});
