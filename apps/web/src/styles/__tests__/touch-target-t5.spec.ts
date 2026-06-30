/**
 * T5 — Touch-target ≥44px unit tests
 *
 * These fs-read tests verify that interactive controls in the
 * shell / home / library / variant-queue surfaces meet the ≥44×44px
 * hit-area floor required by UXUI-02.
 *
 * Two representative controls are asserted in depth per the Test Coverage
 * Matrix (stepper btn in LibraryCardStepper; variant pill button).
 * The full corpus is covered by the side-stripe + focus guards.
 *
 * Matching strategy: we look for `min-block-size: 44px` OR
 * `min-inline-size: 44px` OR a block-size / inline-size of ≥44 within the
 * relevant CSS class, using a dotAll regex that crosses line boundaries
 * within a rule block.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

function readCss(relPath: string): string {
  return fs.readFileSync(path.join(SRC_ROOT, relPath), 'utf-8');
}

/**
 * Returns true if the given CSS class has a dimension property that
 * guarantees a hit area of at least 44px in the block (vertical) direction.
 *
 * Checks, in order:
 *   - min-block-size: 44px
 *   - min-height: 44px
 *   - block-size: Npx  where N >= 44
 *   - height: Npx      where N >= 44
 */
function hasBlockSizeAtLeast44(css: string, className: string): boolean {
  // Extract the rule block for the given class (first match).
  // Handles multi-line blocks via dotAll flag.
  const blockRe = new RegExp(
    `\\.${className}\\s*\\{([^}]*)\\}`,
    's',
  );
  const match = blockRe.exec(css);
  if (!match) return false;
  // Non-null assertion: match is truthy so match[1] is the captured group string.
  const body = match[1]!;

  if (/min-block-size\s*:\s*44px/.test(body)) return true;
  if (/min-height\s*:\s*44px/.test(body)) return true;

  // block-size or height >= 44
  const bsMatch = /block-size\s*:\s*(\d+)px/.exec(body);
  if (bsMatch && parseInt(bsMatch[1]!, 10) >= 44) return true;
  const hMatch = /height\s*:\s*(\d+)px/.exec(body);
  if (hMatch && parseInt(hMatch[1]!, 10) >= 44) return true;

  return false;
}

/**
 * Returns true if the given CSS class has a dimension property that
 * guarantees a hit area of at least 44px in the inline (horizontal) direction.
 */
function hasInlineSizeAtLeast44(css: string, className: string): boolean {
  const blockRe = new RegExp(
    `\\.${className}\\s*\\{([^}]*)\\}`,
    's',
  );
  const match = blockRe.exec(css);
  if (!match) return false;
  // Non-null assertion: match is truthy so match[1] is the captured group string.
  const body = match[1]!;

  if (/min-inline-size\s*:\s*44px/.test(body)) return true;
  if (/min-width\s*:\s*44px/.test(body)) return true;

  const isMatch = /inline-size\s*:\s*(\d+)px/.exec(body);
  if (isMatch && parseInt(isMatch[1]!, 10) >= 44) return true;
  const wMatch = /width\s*:\s*(\d+)px/.exec(body);
  if (wMatch && parseInt(wMatch[1]!, 10) >= 44) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Representative 1: LibraryCardStepper — .btn
// ---------------------------------------------------------------------------

describe('LibraryCardStepper — stepper .btn hit area ≥44px (T5 / UXUI-02)', () => {
  const css = readCss('components/library/LibraryCardStepper.module.css');

  it('.btn has a block-direction min-size of ≥44px', () => {
    expect(hasBlockSizeAtLeast44(css, 'btn')).toBe(true);
  });

  it('.btn has an inline-direction min-size of ≥44px', () => {
    expect(hasInlineSizeAtLeast44(css, 'btn')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Representative 2: VariantQueuePill — .button
// ---------------------------------------------------------------------------

describe('VariantQueuePill — .button hit area ≥44px (T5 / UXUI-02)', () => {
  const css = readCss('components/variant-queue/VariantQueuePill.module.css');

  it('.button has a block-direction min-size of ≥44px', () => {
    expect(hasBlockSizeAtLeast44(css, 'button')).toBe(true);
  });

  it('.button has an inline-direction min-size of ≥44px', () => {
    expect(hasInlineSizeAtLeast44(css, 'button')).toBe(true);
  });
});
