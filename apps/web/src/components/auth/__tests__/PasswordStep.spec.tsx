import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthFetchError } from '../../../lib/auth-fetch';
import { rememberSignIn } from '../../../lib/remembered-account';
import { makeAuth, renderWithAuth } from './accountTestKit';

import { PasswordStep } from '../PasswordStep';

const EMAIL = 'lucas.prado@hotmail.com';

function renderStep(auth = makeAuth()) {
  const props = { email: EMAIL, onChangeEmail: vi.fn(), onUseCode: vi.fn(), onSignedIn: vi.fn() };
  return { auth, props, ...renderWithAuth(<PasswordStep {...props} />, auth) };
}

function inOrder(...nodes: readonly HTMLElement[]): void {
  for (let i = 1; i < nodes.length; i++) {
    expect(nodes[i - 1]!.compareDocumentPosition(nodes[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  }
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.clearAllMocks());

describe('PasswordStep', () => {
  it('an account with a password offers the password and the code', async () => {
    const { props } = renderStep();

    inOrder(
      screen.getByText('E-mail'),
      screen.getByText(EMAIL),
      screen.getByRole('button', { name: 'Não é você? Trocar' }),
      screen.getByLabelText('Senha'),
      screen.getByRole('button', { name: 'Entrar' }),
      screen.getByRole('button', { name: 'Entrar com um código por e-mail' }),
      screen.getByText('Esqueceu a senha? Entre com um código e troque a senha em Configurações.'),
    );
    expect(screen.queryByText('Da última vez você entrou com senha neste celular.')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Entrar com um código por e-mail' }));
    await userEvent.click(screen.getByRole('button', { name: 'Não é você? Trocar' }));
    expect(props.onUseCode).toHaveBeenCalledTimes(1);
    expect(props.onChangeEmail).toHaveBeenCalledTimes(1);
  });

  it('says the last sign-in used a password only when this device stored one for the address', () => {
    rememberSignIn('someone.else@gmail.com', 'password');
    const other = renderStep();
    expect(screen.queryByText('Da última vez você entrou com senha neste celular.')).not.toBeInTheDocument();
    other.unmount();

    rememberSignIn(EMAIL, 'password');
    renderStep();
    expect(screen.getByText('Da última vez você entrou com senha neste celular.')).toBeInTheDocument();
  });

  it('signs in with the password and remembers the address', async () => {
    const { auth, props } = renderStep();

    await userEvent.type(screen.getByLabelText('Senha'), 'my-long-password');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(auth.signIn).toHaveBeenCalledWith(EMAIL, 'my-long-password'));
    expect(props.onSignedIn).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('ra.lastEmail')).toBe(EMAIL);
  });

  it('a wrong password offers the code', async () => {
    const signIn = vi.fn().mockRejectedValue(new AuthFetchError('Invalid', 401, null, 'INVALID_CREDENTIALS'));
    const { props } = renderStep(makeAuth({ signIn }));

    await userEvent.type(screen.getByLabelText('Senha'), 'not-the-password');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Senha incorreta.')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toHaveAttribute('aria-invalid', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar com um código' }));
    expect(props.onUseCode).toHaveBeenCalledTimes(1);
    expect(props.onSignedIn).not.toHaveBeenCalled();
  });

  it('shows the wait when the server limits the tries', async () => {
    const signIn = vi.fn().mockRejectedValue(new AuthFetchError('Too many', 429, 120, null));
    renderStep(makeAuth({ signIn }));

    await userEvent.type(screen.getByLabelText('Senha'), 'a-password-123');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Aguarde 2 minutos');
  });
  it('too many tries says the wait and the other way in', async () => {
    const signIn = vi.fn().mockRejectedValue(new AuthFetchError('Too many', 429, 300, null));
    const { props } = renderStep(makeAuth({ signIn }));

    await userEvent.type(screen.getByLabelText('Senha'), 'a-long-enough-password');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('Muitas tentativas. Aguarde 5 minutos e tente novamente.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entre com um código por e-mail' }));
    expect(props.onUseCode).toHaveBeenCalledTimes(1);
  });
});
