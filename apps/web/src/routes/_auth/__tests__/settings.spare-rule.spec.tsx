import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Providers, response } from '../../../components/spare/__tests__/spareKit';
import { AuthContext, type IAuthContext } from '../../../auth/AuthContext';

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('../../../lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api-client')>()),
  useApiClient: () => api.fetch,
}));
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => undefined,
  useNavigate: () => vi.fn(),
}));
vi.mock('../../../components/shell/ThemeToggle', () => ({ ThemeToggle: () => <div /> }));
vi.mock('../../../components/shell/LanguageToggle', () => ({ LanguageToggle: () => <div /> }));
vi.mock('../../../components/settings/AccountSetting', () => ({ AccountSetting: () => <div /> }));
vi.mock('../../../components/settings/ContactSetting', () => ({ ContactSetting: () => <div /> }));
vi.mock('../../../components/settings/DisplayNameSetting', () => ({ DisplayNameSetting: () => <div /> }));
vi.mock('../../../components/delete-account-modal', () => ({ DeleteAccountModal: () => null }));

import { SettingsPage } from '../settings';

const auth = { user: { id: 'u1', email: 'hero@rathe.gg', role: 'user', chatAccess: false }, isLoading: false } as unknown as IAuthContext;

function renderSettings(): void {
  render(
    <AuthContext.Provider value={auth}>
      <Providers>
        <SettingsPage />
      </Providers>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  api.fetch.mockReset();
});

describe('settings, the spare rule', () => {
  it('settings change the spare rule', async () => {
    api.fetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/collection/spare') return response({ rule: 'any_deck' });
      if (path === '/users/me/spare-rule' && init?.method === 'PUT') return { rule: 'per_deck' };
      throw new Error(`unhandled ${path}`);
    });
    renderSettings();

    expect(await screen.findByText('Sua regra: você passa cartas entre quaisquer decks')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mudar' }));

    expect(screen.getByRole('radio', { name: /Sim, entre quaisquer decks/ })).toBeChecked();
    expect(screen.getByText('Sobram 19 cópias')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Não, cada deck tem as próprias cartas/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    await waitFor(() => expect(api.fetch).toHaveBeenCalledWith('/users/me/spare-rule', { method: 'PUT', body: JSON.stringify({ rule: 'per_deck' }) }));
    expect(await screen.findByRole('heading', { name: 'Cartas sobrando' })).toBeInTheDocument();
  });

  it('offers to choose the rule while none is stored', async () => {
    api.fetch.mockResolvedValue(response({ rule: null, counts: { within_format: 20, any_deck: 20, per_deck: 20 } }));
    renderSettings();

    expect(await screen.findByText('Você ainda não escolheu como contar o que sobra.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Escolher' })).toBeInTheDocument();
  });
});
