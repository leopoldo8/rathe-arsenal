/**
 * T6 — MarkOwnedButton touch-target + type attribute tests (UXUI-02)
 *
 * Covers:
 *  - DOM: rendered button carries type="button" (prevents accidental form submit)
 *  - CSS file: .btn has min-block-size ≥ 44px (touch floor per R52)
 *  - CSS file: .btn uses var(--ra-ready-high) for background (token not raw hex)
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..',
);

function readCss(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), 'utf-8');
}

// mark-owned-button uses useTranslation — i18n is initialized globally in setup.ts.
// No additional mock needed.

import { MarkOwnedButton } from '../../../components/mark-owned-button';

// ---------------------------------------------------------------------------
// DOM tests
// ---------------------------------------------------------------------------

describe('MarkOwnedButton — type="button" (T6 / UXUI-02)', () => {
  it('renders a <button> with type="button" so it does not submit a form', () => {
    render(
      <MarkOwnedButton
        cardIdentifier="WTR001"
        onMarkOwned={vi.fn()}
        isPending={false}
        pendingCard={null}
      />,
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('type', 'button');
  });
});

// ---------------------------------------------------------------------------
// CSS file assertions
// ---------------------------------------------------------------------------

describe('MarkOwnedButton CSS — 44px touch floor + green token (T6 / UXUI-02)', () => {
  const css = readCss('components/mark-owned-button.module.css');

  it('.btn has min-block-size: 44px', () => {
    const re = /\.btn\s*\{[^}]*min-block-size\s*:\s*44px/s;
    expect(re.test(css)).toBe(true);
  });

  it('.btn uses var(--ra-ready-high) for background, not a raw hex', () => {
    // Must reference the token
    const hasToken = /\.btn\s*\{[^}]*background[^:]*:[^}]*var\(--ra-ready-high\)/s.test(css);
    expect(hasToken).toBe(true);
  });

  it('.btn does NOT contain raw #38a169', () => {
    expect(css).not.toContain('#38a169');
  });
});
