import { describe, it, expect } from 'vitest';
import { RECOMMENDATION_FAILURE_CODES } from '../../api/recommendations';
import { ptBR } from '../locales/pt-BR';
import { enUS } from '../locales/en-US';

const PANEL_KEYS = [
  'title', 'generate', 'generateAria', 'generating', 'stale', 'empty', 'noUpgrades', 'loadError', 'retry', 'listAria',
  'clearUpgrade', 'owned', 'outOfStock', 'buyAria', 'previewAria', 'cost', 'replaces', 'cutLabel', 'cutGone', 'cutNone', 'adopt', 'adoptAria', 'dismiss',
  'dismissAria', 'dismissed', 'undo',
] as const;

describe('recommendations locales', () => {
  it('both locales cover the panel and every failure code', () => {
    expect(RECOMMENDATION_FAILURE_CODES).toHaveLength(12);
    for (const [locale, catalog] of [['pt-BR', ptBR], ['en-US', enUS]] as const) {
      const recommendations = catalog.recommendations as Record<string, unknown>;
      for (const key of PANEL_KEYS) {
        expect({ locale, key, value: typeof recommendations[key] }).toEqual({ locale, key, value: 'string' });
        expect({ locale, key, empty: (recommendations[key] as string).trim() === '' }).toEqual({ locale, key, empty: false });
      }
      const failure = recommendations['failure'] as Record<string, string>;
      expect({ locale, codes: Object.keys(failure).sort() }).toEqual({ locale, codes: [...RECOMMENDATION_FAILURE_CODES].sort() });
      for (const code of RECOMMENDATION_FAILURE_CODES) {
        expect({ locale, code, empty: failure[code]!.trim() === '' }).toEqual({ locale, code, empty: false });
      }
      const home = catalog.home as Record<string, unknown>;
      expect({ locale, one: typeof home['upgradesSuggested_one'], other: typeof home['upgradesSuggested_other'] }).toEqual({
        locale,
        one: 'string',
        other: 'string',
      });
    }
    expect(Object.keys(enUS.recommendations).sort()).toEqual(Object.keys(ptBR.recommendations).sort());
  });
});
