import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthFetchError } from '../../../lib/auth-fetch';
import { makeAuth, renderWithAuth, stubViewport } from './accountTestKit';

const navigateMock = vi.hoisted(() => vi.fn());
const pushMock = vi.hoisted(() => vi.fn());
const showMock = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  useRouter: () => ({ history: { push: pushMock } }),
}));
vi.mock('../../ui/Toast/useToast', () => ({ useToast: () => ({ show: showMock }) }));

import { NewAccountStep } from '../NewAccountStep';

const EMAIL = 'bia.souza@gmail.com';
const STAYING_IN_PHONE =
  'A conta fica aberta neste celular até você tocar em Sair. Sem senha, mandamos um código só quando você entrar de novo.';

function renderStep(overrides: Partial<React.ComponentProps<typeof NewAccountStep>> = {}, auth = makeAuth()) {
  const props = { email: EMAIL, shareReturn: null, origin: null, onWrongEmail: vi.fn(), ...overrides };
  return { auth, props, ...renderWithAuth(<NewAccountStep {...props} />, auth) };
}

beforeEach(() => {
  stubViewport(true);
  localStorage.clear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('NewAccountStep', () => {
  it('a new address offers one button and the password link', async () => {
    const { props } = renderStep();

    expect(document.body.textContent).toContain(`Primeira vez aqui? Vamos criar sua conta com ${EMAIL}.`);
    expect(screen.getByText(EMAIL).tagName).toBe('STRONG');
    const order = [
      screen.getByRole('button', { name: 'Errei o e-mail' }),
      screen.getByRole('button', { name: 'Criar conta e entrar' }),
      screen.getByRole('button', { name: 'Prefiro criar uma senha' }),
      screen.getByText(STAYING_IN_PHONE),
    ];
    for (let i = 1; i < order.length; i++) {
      expect(order[i - 1]!.compareDocumentPosition(order[i]!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Errei o e-mail' }));
    expect(props.onWrongEmail).toHaveBeenCalledTimes(1);
  });

  it('creating the account signs in and opens the first-steps page', async () => {
    const { auth } = renderStep();

    await userEvent.click(screen.getByRole('button', { name: 'Criar conta e entrar' }));

    await waitFor(() => expect(auth.signUp).toHaveBeenCalledWith({ email: EMAIL }));
    expect(showMock).toHaveBeenCalledWith({
      kind: 'success',
      message: `Conta criada. Toque no botão do e-mail que mandamos para ${EMAIL} para confirmar.`,
    });
    expect(navigateMock).toHaveBeenCalledWith({ to: '/onboarding' });
    expect(localStorage.getItem('ra.lastEmail')).toBe(EMAIL);
  });

  it('the password field opens in place and checks the rule only on submit', async () => {
    const { auth } = renderStep();

    await userEvent.click(screen.getByRole('button', { name: 'Prefiro criar uma senha' }));

    const field = screen.getByLabelText('Senha');
    expect(field).toHaveValue('');
    expect(field).toHaveFocus();
    expect(screen.getByText('Pelo menos 10 caracteres.')).toBeInTheDocument();
    expect(screen.getByText('Com senha, você entra sem abrir o e-mail.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar conta com senha e entrar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar sem senha' })).toBeInTheDocument();
    expect(field).not.toHaveAttribute('aria-invalid');

    await userEvent.type(field, '123456789');
    expect(field).not.toHaveAttribute('aria-invalid');
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta com senha e entrar' }));
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('A senha precisa ter pelo menos 10 caracteres.')).toBeInTheDocument();
    expect(auth.signUp).not.toHaveBeenCalled();

    await userEvent.type(field, '0');
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta com senha e entrar' }));
    await waitFor(() => expect(auth.signUp).toHaveBeenCalledWith({ email: EMAIL, password: '1234567890' }));

    expect(navigateMock).toHaveBeenCalledWith({ to: '/onboarding' });
  });

  it('"Criar sem senha" closes the password field again', async () => {
    renderStep();
    await userEvent.click(screen.getByRole('button', { name: 'Prefiro criar uma senha' }));

    await userEvent.click(screen.getByRole('button', { name: 'Criar sem senha' }));

    expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar conta e entrar' })).toBeInTheDocument();
  });

  it('the staying-in line is said once, for a phone or a computer', () => {
    stubViewport(true);
    const phone = renderStep();
    expect(screen.getAllByText(/A conta fica aberta/)).toHaveLength(1);
    expect(screen.getByText(STAYING_IN_PHONE)).toBeInTheDocument();
    phone.unmount();

    stubViewport(false);
    renderStep();
    expect(screen.getAllByText(/A conta fica aberta/)).toHaveLength(1);
    expect(screen.getByText(STAYING_IN_PHONE.replace('neste celular', 'neste computador'))).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('Você continua conectada');
  });

  it('an account made from a shared deck sends the page and the token, then goes back to it', async () => {
    const { auth } = renderStep({
      shareReturn: { returnTo: '/d/abc123', shareToken: 'abc123' },
      origin: { kind: 'deck', name: 'Rhinar - Blitz', ownerName: 'Bia', reason: 'deck', imageUrl: null },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Criar conta e entrar' }));

    await waitFor(() =>
      expect(auth.signUp).toHaveBeenCalledWith({ email: EMAIL, shareToken: 'abc123', returnPath: '/d/abc123' }),
    );
    expect(pushMock).toHaveBeenCalledWith('/d/abc123');
    expect(showMock).toHaveBeenCalledWith({ kind: 'success', message: 'Conta criada. Você voltou para o deck da Bia.' });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('a new account lands back on the list with its toast', async () => {
    renderStep({
      shareReturn: { returnTo: '/l/xyz789', shareToken: 'xyz789' },
      origin: { kind: 'list', name: 'Quero estas', ownerName: 'Pedro', reason: 'cards', imageUrl: null },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Criar conta e entrar' }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/l/xyz789'));
    expect(showMock).toHaveBeenCalledWith({ kind: 'success', message: 'Conta criada. Você voltou para a lista do Pedro.' });
  });

  it('says what went wrong when the server refuses', async () => {
    const signUp = vi.fn().mockRejectedValue(new AuthFetchError('taken', 409, null, 'EMAIL_TAKEN'));
    renderStep({}, makeAuth({ signUp }));

    await userEvent.click(screen.getByRole('button', { name: 'Criar conta e entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Já existe uma conta com este e-mail');
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
