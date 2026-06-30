/**
 * VerifyEmail — error state danger treatment (UXUI-10)
 *
 * Asserts that when email verification fails, the error container
 * uses the `errorBox` CSS class (danger token family) instead of
 * the neutral `infoBox`. Uses a source-file check since the route
 * component depends on live router bindings (Route.useSearch) that
 * are hard to wire in a unit test.
 *
 * UXUI-10 AC1: error container SHALL carry `styles.errorBox` (danger
 * token family) — specifically role="alert" + className={styles.errorBox}.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROUTES_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

describe('verify-email error state — danger treatment (UXUI-10)', () => {
  it('error branch uses errorBox class (danger token family), not infoBox (UXUI-10 AC1)', () => {
    const src = fs.readFileSync(path.join(ROUTES_DIR, 'verify-email.tsx'), 'utf-8');
    // Should use errorBox for the error state
    expect(src).toContain('styles.errorBox');
    // The error branch element has role="alert" paired with styles.errorBox
    expect(src).toMatch(/role="alert"[^{]*className=\{styles\.errorBox\}|className=\{styles\.errorBox\}[^}]*role="alert"/);
    // Should NOT pair infoBox with role="alert" (infoBox is for neutral states only)
    expect(src).not.toMatch(/role="alert"[^{]*className=\{styles\.infoBox\}/);
  });
});
