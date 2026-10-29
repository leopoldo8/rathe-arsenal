import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localizeAuthError } from '../../auth/localize-auth-error';
import { resendConfirmation } from '../../lib/account-api';

interface IResendConfirmation {
  readonly sending: boolean;
  /** The localized failure of the last try, or null. */
  readonly error: string | null;
  /** Resolves true once the e-mail was sent again. */
  readonly resend: () => Promise<boolean>;
}

export function useResendConfirmation(): IResendConfirmation {
  const { t } = useTranslation();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resend(): Promise<boolean> {
    if (sending) return false;
    setSending(true);
    setError(null);
    try {
      await resendConfirmation();
      return true;
    } catch (err) {
      setError(localizeAuthError(err, t));
      return false;
    } finally {
      setSending(false);
    }
  }

  return { sending, error, resend };
}
