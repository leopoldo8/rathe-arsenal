import React, { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../../../auth/AuthProvider';
import { authFetch } from '../../../lib/auth-fetch';
import { jsonResponse } from './accountTestKit';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
  useNavigate: () => vi.fn(),
  useRouter: () => ({ history: { push: vi.fn(), replace: vi.fn() } }),
}));

import { SignInSheet } from '../SignInSheet';

const ME = { id: 'u1', email: 'bia.souza@gmail.com', role: 'user', chatAccess: false, settings: { theme: 'dark' } };
const SIGN_IN = { user: { id: 'u1', email: 'bia.souza@gmail.com', role: 'user', chatAccess: false }, settings: { theme: 'dark' } };

/** A page with a quantity the player changed and a save button that calls the API, as the deck editor does. */
function EditPage(): React.ReactElement {
  const [quantity, setQuantity] = useState('3');
  return (
    <main>
      <label>
        Quantidade
        <input value={quantity} onChange={(event) => setQuantity(event.target.value)} />
      </label>
      <button type="button" onClick={() => void authFetch('/decks/12', { method: 'PUT', body: '{}' }).catch(() => undefined)}>
        Salvar
      </button>
    </main>
  );
}

function renderEditPage(): void {
  const queryClient = new QueryClient();
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <EditPage />
        <SignInSheet />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

let sessionEnded = false;

beforeEach(() => {
  localStorage.clear();
  sessionEnded = false;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/api/auth/me') return jsonResponse(ME);
      if (url === '/api/decks/12') return jsonResponse({ error: 'Unauthorized', statusCode: 401 }, 401);
      if (url === '/api/auth/start') return jsonResponse({ next: 'password' });
      if (url === '/api/auth/sign-in') {
        sessionEnded = false;
        return jsonResponse(SIGN_IN);
      }
      return jsonResponse({}, 404);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SignInSheet', () => {
  it('a 401 opens the sheet and a sign-in closes it on the same page', async () => {
    renderEditPage();
    const quantity = await screen.findByLabelText('Quantidade');
    await userEvent.clear(quantity);
    await userEvent.type(quantity, '4');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    sessionEnded = true;
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    const sheet = await screen.findByRole('dialog');
    const email = within(sheet).getByLabelText('Seu e-mail');
    expect(email).toHaveValue('bia.souza@gmail.com');
    expect(screen.getByLabelText('Quantidade')).toHaveValue('4');

    await userEvent.click(within(sheet).getByRole('button', { name: 'Continuar' }));
    await userEvent.type(await within(sheet).findByLabelText('Senha'), 'a-long-enough-password');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(sessionEnded).toBe(false);
    expect(screen.getByLabelText('Quantidade')).toHaveValue('4');
  });

  it('a wrong password keeps the sheet open', async () => {
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      if (url === '/api/auth/me') return jsonResponse(ME);
      if (url === '/api/decks/12') return jsonResponse({ error: 'Unauthorized' }, 401);
      if (url === '/api/auth/start') return jsonResponse({ next: 'password' });
      if (url === '/api/auth/sign-in') return jsonResponse({ error: 'Invalid', code: 'INVALID_CREDENTIALS' }, 401);
      return jsonResponse({}, 404);
    });
    renderEditPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Salvar' }));
    const sheet = await screen.findByRole('dialog');

    await userEvent.click(within(sheet).getByRole('button', { name: 'Continuar' }));
    await userEvent.type(await within(sheet).findByLabelText('Senha'), 'wrong-password-123');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Entrar' }));

    expect(await within(sheet).findByText('Senha incorreta.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
