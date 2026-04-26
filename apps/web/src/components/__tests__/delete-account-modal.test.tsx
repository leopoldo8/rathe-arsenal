import { ReactNode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeleteAccountModal } from '../delete-account-modal';
import { AuthContext, IAuthContext } from '../../auth/AuthContext';
import { AuthFetchError } from '../../auth/AuthProvider';

/**
 * Phase 1a Unit 2 (A8) test coverage:
 *  - Submit is disabled until both password and checkbox are populated
 *  - Happy path calls `deleteAccount(password)` and fires `onDeleted`
 *  - 401 AuthFetchError renders an inline "Incorrect password" error
 *  - 429 AuthFetchError renders the shared rate-limit message
 *  - Escape key closes the modal (when not submitting)
 *
 * Global `cleanup()` in `src/test/setup.ts` handles unmounting between
 * tests, so no manual DOM reset is needed here.
 */

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface IRenderOpts {
  deleteAccount: IAuthContext['deleteAccount'];
  open?: boolean;
  onClose?: () => void;
  onDeleted?: () => void;
}

function renderModal(opts: IRenderOpts) {
  const noopAsync = async () => {
    /* test stub */
  };
  const stubAuthContext: IAuthContext = {
    user: { id: 'u1', email: 'a@b.com' },
    token: 'jwt-token',
    isLoading: false,
    signUp: async () => ({}),
    signIn: noopAsync,
    signOut: () => {
      /* test stub */
    },
    verifyEmail: noopAsync,
    forgotPassword: noopAsync,
    resetPassword: noopAsync,
    deleteAccount: opts.deleteAccount,
    setSettings: () => {
      /* test stub */
    },
  };

  const onClose = opts.onClose ?? vi.fn();
  const onDeleted = opts.onDeleted ?? vi.fn();

  const queryClient = createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider value={stubAuthContext}>{children}</AuthContext.Provider>
      </QueryClientProvider>
    );
  }

  const utils = render(
    <Wrapper>
      <DeleteAccountModal open={opts.open ?? true} onClose={onClose} onDeleted={onDeleted} />
    </Wrapper>,
  );

  return { ...utils, onClose, onDeleted, Wrapper };
}

describe('DeleteAccountModal', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders nothing when closed', () => {
    renderModal({ deleteAccount: vi.fn(), open: false });
    // Radix AlertDialog uses role="alertdialog"
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('keeps the submit button disabled until password and checkbox are filled', async () => {
    const user = userEvent.setup();
    const deleteAccount = vi.fn();
    renderModal({ deleteAccount });

    const submit = screen.getByRole('button', { name: /delete my account/i });
    expect(submit).toBeDisabled();

    // Type password only — still disabled.
    await user.type(screen.getByLabelText(/re-enter your password/i), 'hunter2');
    expect(submit).toBeDisabled();

    // Check the checkbox — enabled.
    await user.click(
      screen.getByLabelText(/i understand my account and all data will be permanently deleted/i),
    );
    expect(submit).toBeEnabled();

    // Uncheck — disabled again.
    await user.click(
      screen.getByLabelText(/i understand my account and all data will be permanently deleted/i),
    );
    expect(submit).toBeDisabled();
  });

  it('calls deleteAccount and onDeleted on happy path', async () => {
    const user = userEvent.setup();
    const deleteAccount = vi.fn().mockResolvedValue(undefined);
    const onDeleted = vi.fn();
    renderModal({ deleteAccount, onDeleted });

    await user.type(screen.getByLabelText(/re-enter your password/i), 'hunter2');
    await user.click(
      screen.getByLabelText(/i understand my account and all data will be permanently deleted/i),
    );
    await user.click(screen.getByRole('button', { name: /delete my account/i }));

    await waitFor(() => expect(deleteAccount).toHaveBeenCalledWith('hunter2'));
    expect(onDeleted).toHaveBeenCalledTimes(1);
  });

  it('shows "Incorrect password" inline and keeps the modal open on 401', async () => {
    const user = userEvent.setup();
    const deleteAccount = vi
      .fn()
      .mockRejectedValue(new AuthFetchError('Invalid password', 401));
    const onClose = vi.fn();
    const onDeleted = vi.fn();
    renderModal({ deleteAccount, onClose, onDeleted });

    await user.type(screen.getByLabelText(/re-enter your password/i), 'wrongpw');
    await user.click(
      screen.getByLabelText(/i understand my account and all data will be permanently deleted/i),
    );
    await user.click(screen.getByRole('button', { name: /delete my account/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/incorrect password/i),
    );

    // Modal is still rendered (Radix AlertDialog uses role="alertdialog").
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    // Submit button is re-enabled (not stuck in submitting state).
    expect(screen.getByRole('button', { name: /delete my account/i })).toBeEnabled();
  });

  it('shows the shared rate-limit message on 429', async () => {
    const user = userEvent.setup();
    const deleteAccount = vi
      .fn()
      .mockRejectedValue(new AuthFetchError('Too Many Requests', 429, 120));
    renderModal({ deleteAccount });

    await user.type(screen.getByLabelText(/re-enter your password/i), 'hunter2');
    await user.click(
      screen.getByLabelText(/i understand my account and all data will be permanently deleted/i),
    );
    await user.click(screen.getByRole('button', { name: /delete my account/i }));

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(/too many attempts/i);
      expect(alert).toHaveTextContent(/2 minutes/i);
    });
  });

  it('closes on Escape key', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal({ deleteAccount: vi.fn(), onClose });

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
