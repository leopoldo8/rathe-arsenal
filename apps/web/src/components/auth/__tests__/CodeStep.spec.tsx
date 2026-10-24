import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthFetchError } from '../../../lib/auth-fetch';
import { jsonResponse, makeAuth, renderWithAuth } from './accountTestKit';

import { CodeStep } from '../CodeStep';

function codeRequestAnswer(secondsToResend = 45): Response {
  return jsonResponse(
    { expiresAt: new Date(Date.now() + 900_000).toISOString(), resendAfter: new Date(Date.now() + secondsToResend * 1000).toISOString() },
    202,
  );
}

function renderStep(email: string, auth = makeAuth()) {
  const props = { email, onChangeEmail: vi.fn(), onSignedIn: vi.fn() };
  return { auth, props, ...renderWithAuth(<CodeStep {...props} />, auth) };
}

const boxes = (): HTMLElement[] => screen.getAllByRole('textbox');

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn().mockImplementation(async () => codeRequestAnswer());
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('CodeStep', () => {
  it('the code screen shows the address, six boxes and the spam line', async () => {
    renderStep('renata@cupuladt.com.br');

    expect(document.body.textContent).toContain('Mandamos para renata@cupuladt.com.br. Ele vale 15 minutos.');
    expect(boxes()).toHaveLength(6);
    expect(screen.getByText('No e-mail também tem um botão Entrar.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reenviar em 45 s' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar com outro e-mail' })).toBeInTheDocument();
    expect(screen.getByText('Olhe também o spam.')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/auth/codes');
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toEqual({ email: 'renata@cupuladt.com.br' });
  });

  it('adds the Promotions tab to the spam line for a Gmail address', () => {
    renderStep('bia@gmail.com');

    expect(screen.getByText('Olhe também o spam e a aba Promoções.')).toBeInTheDocument();
  });

  it('counts the resend wait down from the time the server gave', async () => {
    fetchMock.mockImplementation(async () => codeRequestAnswer(1));
    renderStep('renata@cupuladt.com.br');

    expect(await screen.findByRole('button', { name: 'Reenviar em 1 s' })).toHaveAttribute('aria-disabled', 'true');
    const resend = await screen.findByRole('button', { name: 'Reenviar' }, { timeout: 3000 });

    expect(resend).not.toHaveAttribute('aria-disabled');
  });

  it('signs in when the sixth digit is typed', async () => {
    const verifyCode = vi.fn().mockResolvedValue({ returnPath: '/d/abc' });
    const { props } = renderStep('renata@cupuladt.com.br', makeAuth({ verifyCode }));

    await userEvent.click(boxes()[0]!);
    await userEvent.keyboard('482913');

    await waitFor(() => expect(verifyCode).toHaveBeenCalledWith('renata@cupuladt.com.br', '482913'));
    expect(props.onSignedIn).toHaveBeenCalledWith('/d/abc');
    expect(localStorage.getItem('ra.lastEmail')).toBe('renata@cupuladt.com.br');
  });

  it('takes a pasted code in one go', async () => {
    const verifyCode = vi.fn().mockResolvedValue({ returnPath: null });
    renderStep('renata@cupuladt.com.br', makeAuth({ verifyCode }));

    await userEvent.click(boxes()[0]!);
    await userEvent.paste('482 913');

    await waitFor(() => expect(verifyCode).toHaveBeenCalledWith('renata@cupuladt.com.br', '482913'));
  });

  it('a wrong code and an expired code say what to do', async () => {
    const verifyCode = vi
      .fn()
      .mockRejectedValueOnce(new AuthFetchError('no', 401, null, 'INVALID_CODE'))
      .mockRejectedValueOnce(new AuthFetchError('gone', 410, null, 'TOKEN_EXPIRED'));
    renderStep('renata@cupuladt.com.br', makeAuth({ verifyCode }));

    await userEvent.click(boxes()[0]!);
    await userEvent.keyboard('111111');
    expect(await screen.findByText('Este código não confere. Confira no e-mail.')).toBeInTheDocument();
    expect(boxes().map((box) => (box as HTMLInputElement).value)).toEqual(['', '', '', '', '', '']);

    await userEvent.keyboard('222222');
    expect(await screen.findByText('Este código venceu. Ele vale 15 minutos.')).toBeInTheDocument();
    expect(boxes().map((box) => (box as HTMLInputElement).value)).toEqual(['', '', '', '', '', '']);
    expect(document.body.textContent).toContain('Mandamos para renata@cupuladt.com.br.');
    expect(document.body.textContent).not.toContain('Ele vale 15 minutos. Este');

    fetchMock.mockClear();
    await userEvent.click(screen.getByRole('button', { name: 'Mandar um código novo' }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toEqual({ email: 'renata@cupuladt.com.br' });
  });

  it('goes back to the e-mail field from "Entrar com outro e-mail"', async () => {
    const { props } = renderStep('renata@cupuladt.com.br');

    await userEvent.click(screen.getByRole('button', { name: 'Entrar com outro e-mail' }));

    expect(props.onChangeEmail).toHaveBeenCalledTimes(1);
  });
  it('too many tries says the wait and the other way in', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ error: 'Too many' }, 429, { 'Retry-After': '300' }));
    const onUsePassword = vi.fn();
    const withPassword = renderWithAuth(
      <CodeStep email="lucas.prado@hotmail.com" onChangeEmail={vi.fn()} onSignedIn={vi.fn()} onUsePassword={onUsePassword} />,
    );

    expect(await screen.findByText('Muitas tentativas. Aguarde 5 minutos e tente novamente.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entre com a sua senha' }));
    expect(onUsePassword).toHaveBeenCalledTimes(1);
    withPassword.unmount();

    renderStep('renata@cupuladt.com.br');
    expect(await screen.findByText('Muitas tentativas. Aguarde 5 minutos e tente novamente.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Entre com a sua senha' })).not.toBeInTheDocument();
  });
});
