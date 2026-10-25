/**
 * Unit tests for FORMAT_RULES constants in legality/rules.ts.
 *
 * Verifies the structural rules for all 4 supported formats match the
 * LSS Tournament Rules and Policy as of @flesh-and-blood/types@^3.6.243.
 */

import { FORMAT_RULES, RULE_CHANGES } from '../../src/legality/rules';

describe('FORMAT_RULES', () => {
  describe('Classic Constructed', () => {
    const rules = FORMAT_RULES['Classic Constructed'];

    it('has correct mainboard minimum (60)', () => {
      expect(rules.minMainboard).toBe(60);
    });

    it('has no exact mainboard requirement (null)', () => {
      expect(rules.exactMainboard).toBeNull();
    });

    it('has correct max card pool (80)', () => {
      expect(rules.maxCardPool).toBe(80);
    });

    it('allows 3 copies max', () => {
      expect(rules.maxCopies).toBe(3);
    });

    it('does NOT require a young hero', () => {
      expect(rules.requiresYoungHero).toBe(false);
    });

    it('has a non-empty source URL', () => {
      expect(rules.source).toMatch(/fabtcg\.com/);
    });
  });

  describe('Blitz', () => {
    const rules = FORMAT_RULES['Blitz'];

    it('has correct mainboard minimum (40)', () => {
      expect(rules.minMainboard).toBe(40);
    });

    it('has an exact mainboard requirement (40)', () => {
      expect(rules.exactMainboard).toBe(40);
    });

    it('has correct max card pool (52)', () => {
      expect(rules.maxCardPool).toBe(52);
    });

    it('allows 1 copy max', () => {
      expect(rules.maxCopies).toBe(1);
    });

    it('requires a young hero', () => {
      expect(rules.requiresYoungHero).toBe(true);
    });

    it('has a non-empty source URL', () => {
      expect(rules.source).toMatch(/fabtcg\.com/);
    });
  });

  describe('Living Legend', () => {
    const rules = FORMAT_RULES['Living Legend'];

    it('has correct mainboard minimum (60)', () => {
      expect(rules.minMainboard).toBe(60);
    });

    it('has no exact mainboard requirement (null)', () => {
      expect(rules.exactMainboard).toBeNull();
    });

    it('has correct max card pool (80)', () => {
      expect(rules.maxCardPool).toBe(80);
    });

    it('allows 3 copies max', () => {
      expect(rules.maxCopies).toBe(3);
    });

    it('does NOT require a young hero', () => {
      expect(rules.requiresYoungHero).toBe(false);
    });

    it('has a non-empty source URL', () => {
      expect(rules.source).toMatch(/fabtcg\.com/);
    });
  });

  describe('Silver Age', () => {
    const rules = FORMAT_RULES['Silver Age'];

    it('has correct mainboard minimum (40)', () => {
      expect(rules.minMainboard).toBe(40);
    });

    it('has an exact mainboard requirement (40)', () => {
      expect(rules.exactMainboard).toBe(40);
    });

    it('has correct max card pool (55)', () => {
      expect(rules.maxCardPool).toBe(55);
    });

    it('allows 2 copies max', () => {
      expect(rules.maxCopies).toBe(2);
    });

    it('requires a young hero', () => {
      expect(rules.requiresYoungHero).toBe(true);
    });

    it('has a non-empty source URL', () => {
      expect(rules.source).toMatch(/fabtcg\.com/);
    });
  });

  it('covers exactly the 4 supported formats and no others', () => {
    const keys = Object.keys(FORMAT_RULES);
    expect(keys).toHaveLength(4);
    expect(keys).toContain('Classic Constructed');
    expect(keys).toContain('Blitz');
    expect(keys).toContain('Living Legend');
    expect(keys).toContain('Silver Age');
  });

  it('copy and pool limits per format', () => {
    const limits = Object.fromEntries(
      Object.entries(FORMAT_RULES).map(([format, rules]) => [format, [rules.maxCopies, rules.maxCardPool]]),
    );

    expect(limits).toEqual({
      'Classic Constructed': [3, 80],
      'Living Legend': [3, 80],
      Blitz: [1, 52],
      'Silver Age': [2, 55],
    });
    for (const rules of Object.values(FORMAT_RULES)) {
      expect(rules).not.toHaveProperty('allowedRarities');
    }
  });

  it('FORMAT_RULES object itself is frozen (immutable)', () => {
    expect(Object.isFrozen(FORMAT_RULES)).toBe(true);
  });

  it('each format rule entry is frozen (immutable)', () => {
    for (const rules of Object.values(FORMAT_RULES)) {
      expect(Object.isFrozen(rules)).toBe(true);
    }
  });
});

describe('RULE_CHANGES', () => {
  it('RULE_CHANGES shape and first entry', () => {
    expect(Array.isArray(RULE_CHANGES)).toBe(true);
    for (const entry of RULE_CHANGES) {
      expect(Object.keys(entry).sort()).toEqual(['effectiveDate', 'format', 'sourceUrl', 'summaryKey']);
      expect(entry.effectiveDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }

    const [first] = RULE_CHANGES;
    expect(first?.format).toBe('Blitz');
    expect(first?.effectiveDate).toBe('2026-03-09');
    expect(first?.sourceUrl).toBe('https://fabtcg.com/rules-and-policy-center/change-log-tournament-rules-and-policy/');
  });
});
