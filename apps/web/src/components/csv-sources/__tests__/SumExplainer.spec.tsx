/**
 * Unit tests for <SumExplainer /> — i18n locale rendering (UXUI-08 / T14)
 *
 * Spec AC covered:
 *   AC1: "Source A/B", "Total", and the example card name come from t() keys
 *   DOM tests render under pt-BR and assert localized text (no English leak)
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { setTestLocale } from '../../../test/i18n-test-utils';
import { SumExplainer } from '../SumExplainer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderExplainer() {
  return render(<SumExplainer />);
}

/** Open the collapsible so diagram content is visible. */
function openExplainer(): void {
  const trigger = screen.getByRole('button', { name: /duplicate\b|duplicados/i });
  fireEvent.click(trigger);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SumExplainer i18n (T14 / UXUI-08)', () => {
  describe('pt-BR locale (default test locale)', () => {
    it('renders the trigger in Portuguese', () => {
      renderExplainer();
      expect(screen.getByRole('button', { name: /duplicados/i })).toBeInTheDocument();
    });

    it('diagram labels render in Portuguese — no English "Source A/B" or "Total" leak', async () => {
      renderExplainer();
      openExplainer();

      // Portuguese labels must be present
      expect(screen.getByText('Fonte A')).toBeInTheDocument();
      expect(screen.getByText('Fonte B')).toBeInTheDocument();
      expect(screen.getAllByText('Total').length).toBeGreaterThan(0);

      // English labels must not appear
      expect(screen.queryByText('Source A')).not.toBeInTheDocument();
      expect(screen.queryByText('Source B')).not.toBeInTheDocument();
    });

    it('example card name renders in Portuguese — no English "Lightning Press" leak', () => {
      renderExplainer();
      openExplainer();

      expect(screen.queryByText('Lightning Press')).not.toBeInTheDocument();
    });
  });

  describe('en-US locale', () => {
    it('diagram labels render in English under en-US', async () => {
      await setTestLocale('en-US');
      renderExplainer();
      openExplainer();

      expect(screen.getByText('Source A')).toBeInTheDocument();
      expect(screen.getByText('Source B')).toBeInTheDocument();
      expect(screen.getAllByText('Total').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Lightning Press').length).toBeGreaterThan(0);
    });
  });
});
