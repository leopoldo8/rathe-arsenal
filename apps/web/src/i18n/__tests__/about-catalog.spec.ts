/**
 * T1: `about` i18n catalog unit tests
 *
 * Spec ACs covered:
 *  - DISC-02: the en-US `about.disclaimer` must be the verbatim LSS-required
 *    text (source of truth: docs/research/ip-posture.md §"Required
 *    Disclaimer — Exact Text and Placement").
 *  - DISC-04: pt-BR/en-US key parity for the new `about` namespace, and the
 *    pt-BR translation must preserve the trademark substrings verbatim.
 */

import { describe, it, expect } from 'vitest';
import { ptBR } from '../locales/pt-BR';
import { enUS } from '../locales/en-US';

const VERBATIM_EN_DISCLAIMER =
  'Rathe Arsenal is in no way affiliated with Legend Story Studios. Flesh and Blood™, and set names are trademarks of Legend Story Studios®. Characters and names may be protected by copyright.';

describe('about i18n catalog', () => {
  it('en-US about.disclaimer strictly equals the verbatim LSS-required text', () => {
    expect(enUS.about.disclaimer).toBe(VERBATIM_EN_DISCLAIMER);
  });

  it('pt-BR about.disclaimer preserves the "Flesh and Blood™" and "Legend Story Studios®" trademark substrings', () => {
    expect(ptBR.about.disclaimer).toContain('Flesh and Blood™');
    expect(ptBR.about.disclaimer).toContain('Legend Story Studios®');
  });

  it('pt-BR and en-US about namespaces expose the same key set', () => {
    const ptKeys = Object.keys(ptBR.about).sort();
    const enKeys = Object.keys(enUS.about).sort();
    expect(enKeys).toEqual(ptKeys);
  });
});
