import type AxeBuilder from '@axe-core/playwright';

export type TAxeViolation = Awaited<ReturnType<AxeBuilder['analyze']>>['violations'][number];

export interface IScanContext {
  readonly readyDeckId: number;
  readonly shareToken: string;
  /** An import of the fixture user, or a nil id when it has none (the page then shows its error state). */
  readonly sourceId: string;
}

export interface IScanPage {
  readonly name: string;
  readonly path: (context: IScanContext) => string;
  readonly signedOut?: boolean;
  /** Runs after the page loads and before the scan, to put the page in the state worth scanning. */
  readonly prepare?: (page: import('@playwright/test').Page) => Promise<void>;
}

/**
 * Pages the accessibility scan covers. Each slice that builds a page adds it
 * here, so the list only grows.
 */
export const SCAN_PAGES: readonly IScanPage[] = [
  { name: 'home', path: () => '/home' },
  { name: 'deck page', path: ({ readyDeckId }) => `/decks/${readyDeckId}` },
  { name: 'library', path: () => '/library' },
  { name: 'shared deck page', path: ({ shareToken }) => `/d/${shareToken}` },
  { name: 'sign-in', path: () => '/sign-in', signedOut: true },
  { name: 'start', path: () => '/entrar', signedOut: true },
  { name: 'versions of an import', path: ({ sourceId }) => `/library-csv-sources/${sourceId}/versions` },
  { name: 'pasted list', path: () => '/add-cards/list' },
  { name: 'spreadsheet', path: () => '/add-cards/sheet' },
  { name: 'ready-made decks', path: () => '/add-cards/product' },
  { name: 'lines to resolve', path: () => '/library-pending' },
  { name: 'missing list', path: ({ readyDeckId }) => `/decks/${readyDeckId}/missing` },
  { name: 'spare copies', path: () => '/spare' },
  { name: 'the glossary', path: () => '/termos', signedOut: true },
  {
    name: 'the deck page with the Pitch sheet open',
    path: ({ readyDeckId }) => `/decks/${readyDeckId}`,
    prepare: async (page) => {
      await page.getByRole('button', { name: 'O que é Pitch?' }).click();
      await page.getByTestId('glossary-popover').waitFor();
    },
  },
];

const BLOCKING_IMPACTS: ReadonlySet<string> = new Set(['serious', 'critical']);

export function blockingViolations(violations: readonly TAxeViolation[]): readonly TAxeViolation[] {
  return violations.filter((violation) => BLOCKING_IMPACTS.has(violation.impact ?? ''));
}

/** One line per violation, naming the axe rule id and the first selectors so a failure is actionable. */
export function describeViolations(violations: readonly TAxeViolation[]): readonly string[] {
  return violations.map((violation) => {
    const selectors = violation.nodes.slice(0, 3).map((node) => node.target.join(' ')).join(' | ');
    return `${violation.id} (${violation.impact}): ${selectors}`;
  });
}
