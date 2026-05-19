/**
 * Tests for useCascadeCheck hook.
 *
 * Verifies per-card cascade logic with various format/hero combinations.
 * Asserts that the hook does NOT import @rathe-arsenal/engine or
 * @flesh-and-blood/cards (static check via the module content).
 */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCascadeCheck } from '../useCascadeCheck';
import type { ICompositionDraft } from '../useCompositionDraft';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Static check: no engine imports
// ---------------------------------------------------------------------------

describe('useCascadeCheck — no engine import (static check)', () => {
  it('does NOT have an import statement for @rathe-arsenal/engine', () => {
    const filePath = path.resolve(__dirname, '../useCascadeCheck.ts');
    const content = fs.readFileSync(filePath, 'utf8');
    // Check for actual import statements (lines starting with import ... from '@rathe-arsenal/engine')
    const importLines = content
      .split('\n')
      .filter((line) => /^\s*import\s/.test(line));
    const hasEngineImport = importLines.some((line) =>
      line.includes('@rathe-arsenal/engine'),
    );
    expect(hasEngineImport).toBe(false);
  });

  it('does NOT have an import statement for @flesh-and-blood/cards', () => {
    const filePath = path.resolve(__dirname, '../useCascadeCheck.ts');
    const content = fs.readFileSync(filePath, 'utf8');
    const importLines = content
      .split('\n')
      .filter((line) => /^\s*import\s/.test(line));
    const hasFabImport = importLines.some((line) =>
      line.includes('@flesh-and-blood/cards'),
    );
    expect(hasFabImport).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCard(
  cardIdentifier: string,
  opts: {
    legalFormats?: string[];
    legalHeroes?: string[];
    bannedFormats?: string[];
  } = {},
): ICompositionDraft['cards'][number] {
  return {
    cardIdentifier,
    name: cardIdentifier,
    quantity: 1,
    slot: 'mainboard',
    pitch: null,
    cost: null,
    type: 'action',
    imageUrl: null,
    legalFormats: opts.legalFormats ?? [],
    legalHeroes: opts.legalHeroes ?? [],
    bannedFormats: opts.bannedFormats ?? [],
  };
}

function makeDraft(
  cards: ICompositionDraft['cards'],
  format = 'Classic Constructed',
  heroIdentifier: string | null = 'katsu-the-wanderer-wtr',
): ICompositionDraft {
  return { cards, format, heroIdentifier };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useCascadeCheck — N=0 case', () => {
  it('returns count=0 and empty set when all cards are legal', () => {
    const draft = makeDraft([
      makeCard('card-a', { legalFormats: ['Classic Constructed', 'Blitz'] }),
      makeCard('card-b', { legalFormats: ['Classic Constructed'] }),
    ]);
    const { result } = renderHook(() => useCascadeCheck(draft));
    expect(result.current.count).toBe(0);
    expect(result.current.illegalCardIds.size).toBe(0);
  });

  it('returns count=0 for cards with empty legalFormats (conservative fallback)', () => {
    const draft = makeDraft([
      makeCard('card-a', { legalFormats: [] }), // unknown → treated as legal
    ]);
    const { result } = renderHook(() => useCascadeCheck(draft));
    expect(result.current.count).toBe(0);
  });
});

describe('useCascadeCheck — format restriction', () => {
  it('flags card not in legalFormats for the current format', () => {
    const draft = makeDraft(
      [makeCard('card-blitz-only', { legalFormats: ['Blitz'] })],
      'Classic Constructed',
    );
    const { result } = renderHook(() => useCascadeCheck(draft));
    expect(result.current.count).toBe(1);
    expect(result.current.illegalCardIds.has('card-blitz-only')).toBe(true);
  });

  it('does not flag card that is in legalFormats for the current format', () => {
    const draft = makeDraft(
      [makeCard('card-cc', { legalFormats: ['Classic Constructed', 'Blitz'] })],
      'Classic Constructed',
    );
    const { result } = renderHook(() => useCascadeCheck(draft));
    expect(result.current.count).toBe(0);
  });
});

describe('useCascadeCheck — banned format', () => {
  it('flags card banned in the current format', () => {
    const draft = makeDraft(
      [makeCard('banned-card', { bannedFormats: ['Classic Constructed'] })],
      'Classic Constructed',
    );
    const { result } = renderHook(() => useCascadeCheck(draft));
    expect(result.current.count).toBe(1);
    expect(result.current.illegalCardIds.has('banned-card')).toBe(true);
  });

  it('does not flag card banned in a different format', () => {
    const draft = makeDraft(
      [makeCard('card-a', { bannedFormats: ['Blitz'] })],
      'Classic Constructed',
    );
    const { result } = renderHook(() => useCascadeCheck(draft));
    expect(result.current.count).toBe(0);
  });
});

describe('useCascadeCheck — hero restriction', () => {
  it('flags card with hero restriction when current hero not in legalHeroes', () => {
    const draft = makeDraft(
      [makeCard('ninja-card', { legalHeroes: ['katsu-the-wanderer-wtr'] })],
      'Classic Constructed',
      'dorinthea-ironsong-wtr', // not in legalHeroes
    );
    const { result } = renderHook(() => useCascadeCheck(draft));
    expect(result.current.count).toBe(1);
    expect(result.current.illegalCardIds.has('ninja-card')).toBe(true);
  });

  it('does not flag card when hero is in legalHeroes', () => {
    const draft = makeDraft(
      [makeCard('ninja-card', { legalHeroes: ['katsu-the-wanderer-wtr'] })],
      'Classic Constructed',
      'katsu-the-wanderer-wtr', // in legalHeroes
    );
    const { result } = renderHook(() => useCascadeCheck(draft));
    expect(result.current.count).toBe(0);
  });

  it('does not flag card when legalHeroes is empty (no hero restriction)', () => {
    const draft = makeDraft(
      [makeCard('generic-card', { legalHeroes: [] })],
      'Classic Constructed',
      'dorinthea-ironsong-wtr',
    );
    const { result } = renderHook(() => useCascadeCheck(draft));
    expect(result.current.count).toBe(0);
  });

  it('does not flag hero-restricted card when draft heroIdentifier is null', () => {
    const draft = makeDraft(
      [makeCard('ninja-card', { legalHeroes: ['katsu-the-wanderer-wtr'] })],
      'Classic Constructed',
      null, // no hero set
    );
    const { result } = renderHook(() => useCascadeCheck(draft));
    // When no hero is set, the hero restriction cannot be evaluated → conservative
    expect(result.current.count).toBe(0);
  });
});

describe('useCascadeCheck — multiple cards', () => {
  it('counts only illegal cards', () => {
    const draft = makeDraft(
      [
        makeCard('legal-card', { legalFormats: ['Classic Constructed'] }),
        makeCard('illegal-card', { legalFormats: ['Blitz'] }),
        makeCard('also-illegal', { bannedFormats: ['Classic Constructed'] }),
      ],
      'Classic Constructed',
    );
    const { result } = renderHook(() => useCascadeCheck(draft));
    expect(result.current.count).toBe(2);
    expect(result.current.illegalCardIds.has('illegal-card')).toBe(true);
    expect(result.current.illegalCardIds.has('also-illegal')).toBe(true);
    expect(result.current.illegalCardIds.has('legal-card')).toBe(false);
  });
});

describe('useCascadeCheck — format change recomputes cascade', () => {
  it('returns different results when format changes', () => {
    const cards = [
      makeCard('blitz-only-card', { legalFormats: ['Blitz'] }),
    ];
    const ccDraft = makeDraft(cards, 'Classic Constructed');
    const blitzDraft = makeDraft(cards, 'Blitz');

    const { result: ccResult } = renderHook(() => useCascadeCheck(ccDraft));
    const { result: blitzResult } = renderHook(() => useCascadeCheck(blitzDraft));

    expect(ccResult.current.count).toBe(1); // illegal in CC
    expect(blitzResult.current.count).toBe(0); // legal in Blitz
  });
});

describe('useCascadeCheck — hero change recomputes cascade', () => {
  it('returns different results when hero changes', () => {
    const cards = [
      makeCard('ninja-card', { legalHeroes: ['katsu-the-wanderer-wtr'] }),
    ];
    const katsuDraft = makeDraft(cards, 'Classic Constructed', 'katsu-the-wanderer-wtr');
    const dorinthaaDraft = makeDraft(cards, 'Classic Constructed', 'dorinthea-ironsong-wtr');

    const { result: katsuResult } = renderHook(() => useCascadeCheck(katsuDraft));
    const { result: dorinthaResult } = renderHook(() => useCascadeCheck(dorinthaaDraft));

    expect(katsuResult.current.count).toBe(0); // legal for Katsu
    expect(dorinthaResult.current.count).toBe(1); // illegal for Dorinthea
  });
});
