import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import i18n from '../../../i18n';
import type { ISharedCard, ISharedDeckResponse } from '../../../api/shared-decks';
import { buildGroupAskMessage } from '../../share/groupAskMessage';
import { createFakeApi, makeAuth, renderWithProviders, type IFakeApi } from './sharingTestKit';

const apiRef = vi.hoisted(() => ({ current: null as IFakeApi | null }));

vi.mock('../../../lib/auth-fetch', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/auth-fetch')>();
  return { ...actual, authFetch: (...args: Parameters<IFakeApi['authFetch']>) => apiRef.current!.authFetch(...args) };
});
vi.mock('../../ui/Toast/useToast', () => ({ useToast: () => ({ show: vi.fn() }) }));

import { SharedMissingGallery } from '../SharedMissingGallery';

const CARD: ISharedCard = {
  cardIdentifier: 'pack-hunt-red',
  name: 'Pack Hunt',
  pitch: 1,
  type: 'Action - Attack',
  slot: 'mainboard',
  quantity: 7,
  inventoryQuantity: 3,
  imageUrl: null,
  state: 'store_lacks',
  availableCopies: null,
  owned: null,
};

const DECK = {
  intent: 'missing',
  token: 'mQ8rZ3nUp2bX5yKdFgHjLs',
  url: 'https://rathearsenal.app/d/mQ8rZ3nUp2bX5yKdFgHjLs',
  name: '[CC] Brute do Caio',
  hero: 'Rhinar, Reckless Rampage',
  sharerName: 'Caio',
  isOwner: false,
  missing: [CARD],
  missingCount: 7,
  storeSummary: { copies: 0, cents: 0 },
  contactWhatsapp: null,
} as unknown as ISharedDeckResponse;

describe('SharedMissingGallery', () => {
  beforeEach(() => {
    apiRef.current = createFakeApi();
  });

  it('the group ask splits deck and inventory', () => {
    renderWithProviders(<SharedMissingGallery deck={DECK} />, makeAuth({ user: null }));

    const row = screen.getAllByTestId('shared-card')[0]!;
    expect(within(row).getByText('7 cópias · 4 do deck, 3 do inventário')).toBeInTheDocument();
    const message = buildGroupAskMessage(
      {
        deckName: DECK.name,
        hero: DECK.hero,
        url: DECK.url,
        cards: [{ ...CARD, state: 'store_lacks' }],
        closingLine: '',
        includeStoreSide: false,
      },
      i18n.t.bind(i18n),
    );
    expect(message).toContain('7 Pack Hunt (Vermelho) (4 do deck, 3 do inventário)');
  });
});
