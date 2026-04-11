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
 */
afterEach(() => {
  cleanup();
});
