/**
 * i18n tests for <SubstitutionRow /> tier badge (UXUI-08 / T14)
 *
 * Spec AC:
 *   WHEN substitution-row renders the tier badge
 *   THEN "Tier" SHALL come from t() — no hardcoded English literal.
 *
 * Note: this tests the LEGACY substitution-row.tsx (components/substitution-row.tsx)
 * used by breakdown-list. The deck-detail/SubstitutionRow.tsx already used
 * getTierLabel() — that component is not under test here.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { setTestLocale } from '../../test/i18n-test-utils';
import { SubstitutionRow } from '../substitution-row';
import type { IBreakdownEntry, ISubstitutionMatch } from '../../api/deck-detail';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ORIGINAL: IBreakdownEntry = {
  cardIdentifier: 'Pummel',
  name: 'Pummel',
  quantity: 3,
  slot: 'action',
  pitch: 1,
  cost: 2,
  type: 'attack',
  imageUrl: null,
};

const MATCH: ISubstitutionMatch = {
  substitute: {
    cardIdentifier: 'surging-strike',
    name: 'Surging Strike',
    classes: ['brute'],
    pitch: 1,
    power: null,
    defense: null,
    keywords: [],
    imageUrl: null,
  },
  tier: 1,
  score: 0.75,
  rationale: 'Similar pitch and power',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SubstitutionRow tier badge i18n (T14 / UXUI-08)', () => {
  describe('pt-BR locale (default test locale)', () => {
    it('renders tier badge in Portuguese — no English "Tier" literal', () => {
      render(<SubstitutionRow original={ORIGINAL} match={MATCH} />);

      // pt-BR tierLabel is 'Nível {{tier}}'
      expect(screen.getByText('Nível 1')).toBeInTheDocument();

      // English "Tier 1" must not appear
      expect(screen.queryByText('Tier 1')).not.toBeInTheDocument();
    });
  });

  describe('en-US locale', () => {
    it('renders tier badge in English under en-US', async () => {
      await setTestLocale('en-US');
      render(<SubstitutionRow original={ORIGINAL} match={MATCH} />);

      // en-US tierLabel is 'Tier {{tier}}'
      expect(screen.getByText('Tier 1')).toBeInTheDocument();
    });
  });
});
