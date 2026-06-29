import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';
// Import the i18n singleton for its init side-effect and to reset locale
// before each test, so all tests run with a deterministic pt-BR default.
import i18n from '../i18n';

// Stub ResizeObserver — jsdom does not implement it and Radix UI's Popover
// and Select primitives use it internally via @radix-ui/react-use-size.
if (typeof window !== 'undefined' && typeof window.ResizeObserver === 'undefined') {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

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
// Reset locale to pt-BR before every test so component assertions are
// deterministic regardless of the machine's navigator.language or any
// locale switch made by a previous test.
beforeEach(async () => {
  await i18n.changeLanguage('pt-BR');
});

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
