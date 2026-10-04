import type { TFunction } from 'i18next';
import { ApiError } from '../../lib/api-client';

const RATE_LIMITED = 429;

export function localizeApiError(error: unknown, t: TFunction): string {
  if (!(error instanceof ApiError)) return t('apiErrors.generic');
  if (error.status === RATE_LIMITED) return t('apiErrors.rateLimitGeneric');
  const code = readErrorCode(error.message);
  return code ? t(`apiErrors.${code}`, { defaultValue: t('apiErrors.generic') }) : t('apiErrors.generic');
}

function readErrorCode(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { code?: unknown };
    return typeof parsed.code === 'string' ? parsed.code : null;
  } catch {
    return null;
  }
}
