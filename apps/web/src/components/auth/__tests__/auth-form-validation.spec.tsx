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

/** The text of the message a field points at with `aria-describedby`: what the person reads under it. */
function messageUnder(field: HTMLElement): string {
  const ids = (field.getAttribute('aria-describedby') ?? '').split(' ').filter((id) => id !== '');
  return ids.map((id) => document.getElementById(id)?.textContent ?? '').join(' ');
}

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
    expect(messageUnder(screen.getByLabelText('Seu e-mail'))).toBe('Falta o final do e-mail, por exemplo bia@gmail.com');
    start.unmount();

    const newAccount = renderWithAuth(
      <NewAccountStep email="bia@gmail.com" shareReturn={null} origin={null} onWrongEmail={vi.fn()} />,
      makeAuth(),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Prefiro criar uma senha' }));
    await userEvent.type(screen.getByLabelText('Senha'), NINE_CHARACTERS);
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta com senha e entrar' }));
    expect(screen.getByLabelText('Senha')).toHaveAttribute('aria-invalid', 'true');
    expect(messageUnder(screen.getByLabelText('Senha'))).toBe('A senha precisa ter pelo menos 10 caracteres.');
    newAccount.unmount();

    const signIn = renderWithAuth(<PasswordStep email="lucas.prado@hotmail.com" onChangeEmail={vi.fn()} onUseCode={vi.fn()} onSignedIn={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Senha'), NINE_CHARACTERS);
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByLabelText('Senha')).toHaveAttribute('aria-invalid', 'true');
    expect(messageUnder(screen.getByLabelText('Senha'))).toBe('A senha precisa ter pelo menos 10 caracteres');
    signIn.unmount();
    // Nothing was sent by the three forms above: the code step below is the first to talk to the server, and only on mount.
    expect(fetchMock).not.toHaveBeenCalled();

    const code = renderWithAuth(<CodeStep email="renata@cupuladt.com.br" onChangeEmail={vi.fn()} onSignedIn={vi.fn()} />);
    await screen.findByRole('button', { name: /Reenviar/ });
    const sentOnMount = fetchMock.mock.calls.length;
    await userEvent.type(screen.getByLabelText('Dígito 1 de 6'), '12345{Enter}');
    for (const box of screen.getAllByRole('textbox')) expect(box).toHaveAttribute('aria-invalid', 'true');
    const codeMessage = screen.getByRole('alert');
    expect(codeMessage).toHaveTextContent('Faltam números. O código tem 6 dígitos.');
    const boxes = screen.getAllByRole('textbox');
    expect(boxes[boxes.length - 1]!.compareDocumentPosition(codeMessage) & Node.DOCUMENT_POSITION_FOLLOWING, 'the message sits under the boxes').toBeTruthy();
    expect(fetchMock.mock.calls.length, 'five digits sent nothing').toBe(sentOnMount);
    code.unmount();

    const settings = renderWithAuth(
      <AccountSetting />,
      makeAuth({ user: { id: 'u1', email: 'lucas.prado@hotmail.com', role: 'user', chatAccess: false, hasPassword: true } }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Mudar a senha' }));
    await userEvent.type(screen.getByLabelText('Nova senha'), NINE_CHARACTERS);
    await userEvent.click(screen.getByRole('button', { name: 'Salvar senha' }));
    expect(screen.getByLabelText('Nova senha')).toHaveAttribute('aria-invalid', 'true');
    expect(messageUnder(screen.getByLabelText('Nova senha'))).toBe('A senha precisa ter pelo menos 10 caracteres');
    settings.unmount();

    renderWithAuth(<FixEmailForm initialEmail="" onFixed={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Seu e-mail'), TYPO);
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(screen.getByLabelText('Seu e-mail')).toHaveAttribute('aria-invalid', 'true');
    expect(messageUnder(screen.getByLabelText('Seu e-mail'))).toBe('Falta o final do e-mail, por exemplo bia@gmail.com');

    // The only request in the whole run is the code the code step asks for when it opens.
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual(['/api/auth/codes']);
  });
});
