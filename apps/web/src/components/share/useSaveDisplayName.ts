import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { patchDisplayName } from '../../api/shared-decks';
import { useAuth } from '../../auth/useAuth';
import { AuthFetchError } from '../../lib/auth-fetch';

interface ISaveDisplayName {
  readonly saving: boolean;
  readonly error: string | null;
  /** Resolves true once the name is saved, false when it was not. */
  readonly save: (name: string) => Promise<boolean>;
}

/** Saves the name shown on shared links, for the name step of a share dialog. */
export function useSaveDisplayName(): ISaveDisplayName {
  const { t } = useTranslation();
  const { setDisplayName } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(name: string): Promise<boolean> {
    setSaving(true);
    setError(null);
    try {
      const saved = await patchDisplayName(name);
      setDisplayName(saved.displayName);
      setSaving(false);
      return true;
    } catch (caught) {
      setSaving(false);
      setError(
        caught instanceof AuthFetchError && caught.status === 400
          ? t('sharing.displayName.invalid')
          : t('sharing.displayName.saveFailed'),
      );
      return false;
    }
  }

  return { saving, error, save };
}
