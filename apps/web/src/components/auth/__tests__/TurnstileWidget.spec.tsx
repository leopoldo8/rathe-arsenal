import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { makeAuth, renderWithAuth } from './accountTestKit';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useRouter: () => ({ history: { push: vi.fn() } }),
}));
vi.mock('../../ui/Toast/useToast', () => ({ useToast: () => ({ show: vi.fn() }) }));

import { NewAccountStep } from '../NewAccountStep';
import { TurnstileWidget } from '../TurnstileWidget';

afterEach(() => {
  vi.unstubAllEnvs();
  document.querySelectorAll('script[src*="turnstile"]').forEach((node) => node.remove());
});

describe('TurnstileWidget', () => {
  it('no site key, no widget', async () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
    const signUp = vi.fn().mockResolvedValue(undefined);
    const onToken = vi.fn();
    const widget = render(<TurnstileWidget onToken={onToken} />);
    expect(widget.container).toBeEmptyDOMElement();
    expect(document.querySelector('script[src*="turnstile"]')).toBeNull();
    widget.unmount();

    renderWithAuth(<NewAccountStep email="bia@gmail.com" shareReturn={null} origin={null} onWrongEmail={vi.fn()} />, makeAuth({ signUp }));
    expect(screen.queryByTestId('turnstile-widget')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta e entrar' }));

    await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));
    expect(signUp.mock.calls[0]![0]).not.toHaveProperty('turnstileToken');
    expect(onToken).not.toHaveBeenCalled();
  });

  it('a site key loads the script and mounts the widget', () => {
    vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '1x00000000000000000000AA');
    render(<TurnstileWidget onToken={vi.fn()} />);

    expect(screen.getByTestId('turnstile-widget')).toBeInTheDocument();
    expect(document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')).not.toBeNull();
  });
});
