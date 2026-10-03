import { useEffect, useState } from 'react';
import type { IVariantFetchProgress } from '../api/shopping-line';
import { VARIANT_FETCH_POLL_TIMEOUT_MS } from '../api/deck-detail';

/**
 * Whether a variant fetch is actively running, reporting start/stop to the
 * host so it can poll. Polling also stops when the progress entry vanishes
 * (pod restart) or after the 5-minute safety timeout.
 */
export function useVariantFetchPolling(
  progress: IVariantFetchProgress | undefined,
  onPollingChange?: (startedAt: number | undefined) => void,
): boolean {
  const [pollingTimedOut, setPollingTimedOut] = useState(false);
  const isFetching = Boolean(progress?.inProgress && !pollingTimedOut);

  useEffect(() => {
    if (!onPollingChange) return;
    onPollingChange(isFetching ? Date.now() : undefined);
  }, [isFetching, onPollingChange]);

  useEffect(() => {
    if (!isFetching) {
      setPollingTimedOut(false);
      return;
    }
    const timer = setTimeout(() => setPollingTimedOut(true), VARIANT_FETCH_POLL_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isFetching]);

  return isFetching;
}
