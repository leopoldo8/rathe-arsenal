type TListener = () => void;

const listeners = new Set<TListener>();

/**
 * Called by the HTTP wrappers when the API answers `401` to a request that is not a sign-in attempt:
 * the server ended the session (door 17). The auth provider listens and opens the sign-in sheet.
 */
export function notifyUnauthorized(): void {
  for (const listener of [...listeners]) listener();
}

export function onUnauthorized(listener: TListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
