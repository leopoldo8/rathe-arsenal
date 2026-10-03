import { useState } from 'react';

export interface IUseImageFallbackResult {
  /** Current candidate URL, or null once every source has failed. */
  readonly src: string | null;
  readonly exhausted: boolean;
  /** Wire to the img's onError; advances to the next candidate. */
  readonly onError: () => void;
}

interface ICycleState {
  readonly key: string;
  readonly index: number;
}

export function useImageFallback(sources: readonly string[]): IUseImageFallbackResult {
  // Keyed on content, not array identity: callers that rebuild an identical
  // array each render must not reset a cycle already under way.
  const key = sources.join('|');
  const [state, setState] = useState<ICycleState>({ key, index: 0 });
  const index = state.key === key ? state.index : 0;

  const exhausted = sources.length === 0 || index >= sources.length;
  return {
    src: exhausted ? null : (sources[index] ?? null),
    exhausted,
    onError: () =>
      setState((prev) => ({ key, index: (prev.key === key ? prev.index : 0) + 1 })),
  };
}
