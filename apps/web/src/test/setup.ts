import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * Global test setup for the web package.
 *
 * - `@testing-library/jest-dom/vitest` registers DOM-focused matchers such
 *   as `toBeInTheDocument`, `toHaveTextContent`, `toHaveAttribute`.
 * - Explicit `cleanup()` in `afterEach` unmounts React trees between tests.
 *   Vitest with `globals: true` does NOT auto-cleanup the way Jest did; we
 *   register it ourselves to guarantee test isolation.
 *
 * - Pointer capture API stubs: jsdom does not implement the Pointer Events API
 *   fully. Radix UI primitives (Toast, Dialog, etc.) call hasPointerCapture()
 *   and setPointerCapture() on elements. We stub these as no-ops so pointer
 *   events dispatched during tests do not throw.
 */
afterEach(() => {
  cleanup();
});

// Stub Pointer Events API methods that jsdom does not implement.
// These are called by Radix UI internals when pointer events are dispatched.
if (typeof window !== 'undefined') {
  if (!window.Element.prototype.hasPointerCapture) {
    window.Element.prototype.hasPointerCapture = () => false;
  }
  if (!window.Element.prototype.setPointerCapture) {
    window.Element.prototype.setPointerCapture = () => undefined;
  }
  if (!window.Element.prototype.releasePointerCapture) {
    window.Element.prototype.releasePointerCapture = () => undefined;
  }
}
