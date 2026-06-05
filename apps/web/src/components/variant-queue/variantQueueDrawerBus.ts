/**
 * Tiny app-global pub/sub so a "Get exact prices" click anywhere can pop the
 * queue drawer open, without threading drawer state through the component tree.
 *
 * The drawer lives in the TopBar (VariantQueuePill); the trigger lives on the
 * deck detail page. A module-level signal is the lightest coupling between them
 * — no context provider, so existing component tests render unchanged.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

/** Ask the queue drawer to open. No-op if it is not currently mounted. */
export function requestOpenVariantQueueDrawer(): void {
  listeners.forEach((l) => l());
}

/** Subscribe to open requests. Returns an unsubscribe function. */
export function subscribeOpenVariantQueueDrawer(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
