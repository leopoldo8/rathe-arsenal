import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { jsonResponse, makeAuth, renderWithAuth } from './accountTestKit';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useRouter: () => ({ history: { push: vi.fn() } }),
}));
vi.mock('../../ui/Toast/useToast', () => ({ useToast: () => ({ show: vi.fn() }) }));

import { FixEmailForm } from '../../confirmation/FixEmailForm';
import { AccountSetting } from '../../settings/AccountSetting';
import { CodeStep } from '../CodeStep';
import { EmailStep } from '../EmailStep';
import { NewAccountStep } from '../NewAccountStep';
import { PasswordStep } from '../PasswordStep';

const TYPO = 'bia@gmail';
const NINE_CHARACTERS = '123456789';

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn().mockImplementation(async () =>
    jsonResponse({ expiresAt: new Date(Date.now() + 900_000).toISOString(), resendAfter: new Date().toISOString() }, 202),
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('auth forms', () => {
  it('every auth form stops a bad field before the server', async () => {
    const start = renderWithAuth(<EmailStep initialEmail="" fromSharedPage={false} origin={null} onResolved={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Seu e-mail'), TYPO);
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByLabelText('Seu e-mail')).toHaveAttribute('aria-invalid', 'true');
    start.unmount();

    const newAccount = renderWithAuth(
      <NewAccountStep email="bia@gmail.com" shareReturn={null} origin={null} onWrongEmail={vi.fn()} />,
      makeAuth(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Prefiro criar uma senha' }));
    await userEvent.type(screen.getByLabelText('Senha'), NINE_CHARACTERS);
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta com senha e entrar' }));
    expect(screen.getByLabelText('Senha')).toHaveAttribute('aria-invalid', 'true');
    newAccount.unmount();

    const signIn = renderWithAuth(<PasswordStep email="lucas.prado@hotmail.com" onChangeEmail={vi.fn()} onUseCode={vi.fn()} onSignedIn={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Senha'), NINE_CHARACTERS);
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByLabelText('Senha')).toHaveAttribute('aria-invalid', 'true');
    signIn.unmount();

    const code = renderWithAuth(<CodeStep email="renata@cupuladt.com.br" onChangeEmail={vi.fn()} onSignedIn={vi.fn()} />);
    await screen.findByRole('button', { name: /Reenviar/ });
    fetchMock.mockClear();
    await userEvent.type(screen.getByLabelText('Dígito 1 de 6'), '12345{Enter}');
    for (const box of screen.getAllByRole('textbox')) expect(box).toHaveAttribute('aria-invalid', 'true');
    code.unmount();

    const settings = renderWithAuth(
      <AccountSetting />,
      makeAuth({ user: { id: 'u1', email: 'lucas.prado@hotmail.com', role: 'user', chatAccess: false, hasPassword: true } }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Mudar a senha' }));
    await userEvent.type(screen.getByLabelText('Nova senha'), NINE_CHARACTERS);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar senha' }));
    expect(screen.getByLabelText('Nova senha')).toHaveAttribute('aria-invalid', 'true');
    settings.unmount();

    renderWithAuth(<FixEmailForm initialEmail="" onFixed={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Seu e-mail'), TYPO);
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByLabelText('Seu e-mail')).toHaveAttribute('aria-invalid', 'true');

    expect(fetchMock).toHaveBeenCalledTimes(0);
  });
});
