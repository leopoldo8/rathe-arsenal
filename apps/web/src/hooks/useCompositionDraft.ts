/**
 * useCompositionDraft — local draft state for Edit mode composition.
 *
 * Tracks the working copy of a deck's card list, hero, and format while
 * the user is in Edit mode. Persists to localStorage with a 500ms debounce
 * so the draft survives accidental tab close (U13).
 *
 * On Edit-mode entry, reads the stored draft and validates it against the
 * Zod schema. Success → returns hasDraft + draftPayload for the caller to
 * mount DraftRestoreModal. Failure → silently discards (removes the key).
 *
 * Returns a stable interface consumed by DeckCanvas EditBody and
 * DeckDetailHeader Save/Cancel controls.
 */
import { useCallback, useEffect, useMemo, useReducer } from 'react';
import {
  compositionDraftPayloadSchema,
  type TCompositionDraftPayload,
} from './useCompositionDraft.schema';
import type { ISearchCardResult } from '../api/catalog';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TDraftSlot = 'mainboard' | 'hero' | 'weapon' | 'equipment' | 'other';

export interface IDraftCard {
  readonly cardIdentifier: string;
  readonly name: string;
  readonly quantity: number;
  /** The slot this card occupies in the deck. */
  readonly slot: TDraftSlot;
  readonly pitch: number | null;
  readonly cost: number | null;
  readonly type: string;
  /**
   * Card face image. `sources` is the ordered fallback list — CardArt cycles
   * through these `<img>` URLs on `onError` so cards that only publish foiled
   * artwork (Armory Decks, judge promos) still render in the gallery.
   */
  readonly imageUrl: {
    readonly small: string;
    readonly large: string;
    readonly sources?: readonly { readonly small: string; readonly large: string }[];
  } | null;
  /** Legality fields surfaced by the /catalog/search U17 extension. */
  readonly legalFormats: readonly string[];
  readonly legalHeroes: readonly string[];
  readonly bannedFormats: readonly string[];
}

export interface ICompositionDraft {
  readonly cards: readonly IDraftCard[];
  readonly heroIdentifier: string | null;
  readonly format: string;
}

export interface ICompositionDraftResult {
  readonly draft: ICompositionDraft;
  readonly setHero: (heroIdentifier: string | null) => void;
  readonly setFormat: (format: string) => void;
  /**
   * Adds a card to the draft. The destination slot is derived from the
   * card's `types` (a Weapon goes to `weapon`, etc.) — slot is a property
   * of the card type, never a user choice.
   */
  readonly addCard: (card: ISearchCardResult) => void;
  readonly updateQuantity: (cardIdentifier: string, slot: TDraftSlot, quantity: number) => void;
  readonly removeCard: (cardIdentifier: string, slot: TDraftSlot) => void;
  readonly removeIllegalCards: (illegalCardIds: ReadonlySet<string>) => void;
  /** True when the current draft differs from the initial payload. */
  readonly isDirty: boolean;
  /**
   * Net count of changes: cards added + cards removed + qty-changed cards +
   * (1 if hero changed) + (1 if format changed). Used by U13 discard confirm.
   */
  readonly changeCount: number;
  readonly reset: () => void;
  /**
   * applyDraft — merges a restored draft payload (used by U13 restore modal).
   * Replaces the current draft entirely.
   */
  readonly applyDraft: (payload: ICompositionDraft) => void;
  /**
   * clearPersistedDraft — removes the draft from localStorage.
   * Called by Save success path and Cancel-discard path.
   */
  readonly clearPersistedDraft: () => void;
  /**
   * readPersistedDraft — reads and validates the draft from localStorage.
   * Returns the payload if valid, null otherwise (key also removed on failure).
   */
  readonly readPersistedDraft: () => TCompositionDraftPayload | null;
}

// ---------------------------------------------------------------------------
// Initial payload shape
// ---------------------------------------------------------------------------

export interface ICompositionDraftInitialPayload {
  readonly cards: ReadonlyArray<{
    readonly cardIdentifier: string;
    readonly name: string;
    readonly quantity: number;
    readonly slot: string;
    readonly pitch: number | null;
    readonly cost: number | null;
    readonly type: string;
    readonly imageUrl: {
      readonly small: string;
      readonly large: string;
      readonly sources?: readonly { readonly small: string; readonly large: string }[];
    } | null;
    readonly legalFormats?: readonly string[];
    readonly legalHeroes?: readonly string[];
    readonly bannedFormats?: readonly string[];
  }>;
  readonly heroIdentifier: string | null;
  readonly format: string;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

type TDraftAction =
  | { readonly type: 'SET_HERO'; readonly heroIdentifier: string | null }
  | { readonly type: 'SET_FORMAT'; readonly format: string }
  | { readonly type: 'ADD_CARD'; readonly card: IDraftCard }
  | { readonly type: 'UPDATE_QUANTITY'; readonly cardIdentifier: string; readonly slot: TDraftSlot; readonly quantity: number }
  | { readonly type: 'REMOVE_CARD'; readonly cardIdentifier: string; readonly slot: TDraftSlot }
  | { readonly type: 'REMOVE_ILLEGAL'; readonly illegalCardIds: ReadonlySet<string> }
  | { readonly type: 'RESET'; readonly initial: ICompositionDraft }
  | { readonly type: 'APPLY_DRAFT'; readonly payload: ICompositionDraft };

function draftReducer(state: ICompositionDraft, action: TDraftAction): ICompositionDraft {
  switch (action.type) {
    case 'SET_HERO':
      return { ...state, heroIdentifier: action.heroIdentifier };

    case 'SET_FORMAT':
      return { ...state, format: action.format };

    case 'ADD_CARD': {
      // If card already in deck at same slot, increment quantity.
      const existing = state.cards.findIndex(
        (c) => c.cardIdentifier === action.card.cardIdentifier && c.slot === action.card.slot,
      );
      if (existing >= 0) {
        const updated = state.cards.map((c, i) =>
          i === existing ? { ...c, quantity: c.quantity + 1 } : c,
        );
        return { ...state, cards: updated };
      }
      return { ...state, cards: [...state.cards, action.card] };
    }

    case 'UPDATE_QUANTITY': {
      if (action.quantity <= 0) {
        // quantity reaches 0 → auto-remove row
        return {
          ...state,
          cards: state.cards.filter(
            (c) => !(c.cardIdentifier === action.cardIdentifier && c.slot === action.slot),
          ),
        };
      }
      return {
        ...state,
        cards: state.cards.map((c) =>
          c.cardIdentifier === action.cardIdentifier && c.slot === action.slot
            ? { ...c, quantity: action.quantity }
            : c,
        ),
      };
    }

    case 'REMOVE_CARD':
      return {
        ...state,
        cards: state.cards.filter(
          (c) => !(c.cardIdentifier === action.cardIdentifier && c.slot === action.slot),
        ),
      };

    case 'REMOVE_ILLEGAL':
      return {
        ...state,
        cards: state.cards.filter((c) => !action.illegalCardIds.has(c.cardIdentifier)),
      };

    case 'RESET':
      return action.initial;

    case 'APPLY_DRAFT':
      return action.payload;

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Normalise slot string to TDraftSlot
// ---------------------------------------------------------------------------

function normaliseDraftSlot(slot: string): TDraftSlot {
  const s = slot.toLowerCase();
  if (s.includes('hero')) return 'hero';
  if (s.includes('weapon')) return 'weapon';
  if (s.includes('equipment')) return 'equipment';
  if (
    s.includes('action') ||
    s.includes('attack') ||
    s.includes('reaction') ||
    s.includes('aura') ||
    s.includes('instant') ||
    s.includes('resource') ||
    s.includes('mentor') ||
    s.includes('token') ||
    s.includes('card') ||
    s === 'mainboard'
  ) {
    return 'mainboard';
  }
  return 'other';
}

/**
 * Derives the deck slot from a card's `types` array. The slot is a property
 * of the card type, not a user choice — a Weapon goes to `weapon`, an
 * Equipment to `equipment`, etc. Anything else lands in `mainboard`.
 *
 * Matches `normaliseDraftSlot` semantics so an imported deck (slot string
 * from the API) and an in-edit pick (types array) converge on the same value.
 */
export function inferSlotFromCardTypes(
  types: readonly string[],
): TDraftSlot {
  for (const t of types) {
    const s = t.toLowerCase();
    if (s.includes('hero')) return 'hero';
    if (s.includes('weapon')) return 'weapon';
    if (s.includes('equipment')) return 'equipment';
  }
  return 'mainboard';
}

function buildInitialDraft(payload: ICompositionDraftInitialPayload): ICompositionDraft {
  return {
    cards: payload.cards.map((c) => ({
      cardIdentifier: c.cardIdentifier,
      name: c.name,
      quantity: c.quantity,
      slot: normaliseDraftSlot(c.slot),
      pitch: c.pitch,
      cost: c.cost,
      type: c.type,
      imageUrl: c.imageUrl,
      legalFormats: c.legalFormats ?? [],
      legalHeroes: c.legalHeroes ?? [],
      bannedFormats: c.bannedFormats ?? [],
    })),
    heroIdentifier: payload.heroIdentifier,
    format: payload.format,
  };
}

// ---------------------------------------------------------------------------
// Change counting helpers
// ---------------------------------------------------------------------------

function computeChangeCount(
  initial: ICompositionDraft,
  current: ICompositionDraft,
): number {
  let count = 0;

  // Hero change
  if (initial.heroIdentifier !== current.heroIdentifier) count += 1;

  // Format change
  if (initial.format !== current.format) count += 1;

  // Cards: build a map keyed by cardIdentifier+slot for O(n) comparison
  type TCardKey = string;
  const initialMap = new Map<TCardKey, number>();
  for (const c of initial.cards) {
    initialMap.set(`${c.cardIdentifier}::${c.slot}`, c.quantity);
  }
  const currentMap = new Map<TCardKey, number>();
  for (const c of current.cards) {
    currentMap.set(`${c.cardIdentifier}::${c.slot}`, c.quantity);
  }

  // Added or changed
  for (const [key, qty] of currentMap) {
    const initialQty = initialMap.get(key);
    if (initialQty === undefined) {
      count += 1; // added
    } else if (initialQty !== qty) {
      count += 1; // qty changed
    }
  }
  // Removed
  for (const key of initialMap.keys()) {
    if (!currentMap.has(key)) {
      count += 1; // removed
    }
  }

  return count;
}

function isDraftDirty(initial: ICompositionDraft, current: ICompositionDraft): boolean {
  return computeChangeCount(initial, current) > 0;
}

// ---------------------------------------------------------------------------
// localStorage key + persistence helpers
// ---------------------------------------------------------------------------

/**
 * Returns the localStorage key for a given deck ID.
 * Pattern: `ra-deck-draft-{deckId}` (sign-out cleanup sweeps this prefix).
 */
export function draftStorageKey(deckId: string | number): string {
  return `ra-deck-draft-${String(deckId)}`;
}

/**
 * Reads and validates the draft from localStorage for the given deck.
 * Returns the validated payload on success, or null on any failure
 * (missing key, JSON parse error, Zod validation error).
 * Silently removes the key on validation failure.
 */
export function readStoredDraft(deckId: string | number): TCompositionDraftPayload | null {
  const key = draftStorageKey(deckId);
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return null;
  }
  if (raw == null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Corrupt JSON — silently discard.
    try { localStorage.removeItem(key); } catch { /* private mode */ }
    return null;
  }

  const result = compositionDraftPayloadSchema.safeParse(parsed);
  if (!result.success) {
    // Schema mismatch (tampered or version-drifted payload) — silently discard.
    try { localStorage.removeItem(key); } catch { /* private mode */ }
    return null;
  }
  return result.data;
}

/**
 * Removes the localStorage draft key for the given deck.
 * Called on Save success and Cancel-discard.
 */
export function clearStoredDraft(deckId: string | number): void {
  try {
    localStorage.removeItem(draftStorageKey(deckId));
  } catch { /* private mode */ }
}

/**
 * Writes the current draft to localStorage in the validated schema shape.
 */
function writeStoredDraft(deckId: string | number, draft: ICompositionDraft): void {
  const payload: TCompositionDraftPayload = {
    version: 'v1',
    heroIdentifier: draft.heroIdentifier,
    format: draft.format,
    cards: draft.cards.map((c) => ({
      cardIdentifier: c.cardIdentifier,
      quantity: c.quantity,
      slot: c.slot,
    })),
  };
  try {
    localStorage.setItem(draftStorageKey(deckId), JSON.stringify(payload));
  } catch { /* storage quota exceeded or private mode */ }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useCompositionDraft — manages the mutable composition draft for Edit mode.
 *
 * @param deckId - The deck ID (used for localStorage key: `ra-deck-draft-{id}`).
 * @param initialPayload - The deck's current composition loaded from the API.
 */
export function useCompositionDraft(
  deckId: string | number,
  initialPayload: ICompositionDraftInitialPayload,
): ICompositionDraftResult {
  const initial = useMemo(() => buildInitialDraft(initialPayload), [initialPayload]);

  const [draft, dispatch] = useReducer(draftReducer, initial);

  const isDirty = useMemo(() => isDraftDirty(initial, draft), [initial, draft]);
  const changeCount = useMemo(() => computeChangeCount(initial, draft), [initial, draft]);

  // Debounced localStorage write — 500ms after the last change.
  // Skip when the draft is clean (matches the loaded payload). The mount-time
  // effect would otherwise persist an unchanged draft and trigger the
  // "Restore unsaved changes?" modal on next Edit entry even when the user
  // hasn't touched anything. We do NOT clear here: a pre-existing persisted
  // draft from a previous session must survive mount so the restore modal
  // can offer it. Save and Discard paths clear explicitly.
  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => {
      writeStoredDraft(deckId, draft);
    }, 500);
    return () => clearTimeout(timer);
  }, [deckId, draft, isDirty]);

  const setHero = useCallback((heroIdentifier: string | null) => {
    dispatch({ type: 'SET_HERO', heroIdentifier });
  }, []);

  const setFormat = useCallback((format: string) => {
    dispatch({ type: 'SET_FORMAT', format });
  }, []);

  const addCard = useCallback((card: ISearchCardResult) => {
    const draftCard: IDraftCard = {
      cardIdentifier: card.cardIdentifier,
      name: card.name,
      quantity: 1,
      slot: inferSlotFromCardTypes(card.types),
      pitch: card.pitch,
      cost: null,
      type: card.types[0] ?? 'unknown',
      imageUrl: card.imageUrl,
      legalFormats: card.legalFormats,
      legalHeroes: card.legalHeroes,
      bannedFormats: card.bannedFormats,
    };
    dispatch({ type: 'ADD_CARD', card: draftCard });
  }, []);

  const updateQuantity = useCallback(
    (cardIdentifier: string, slot: TDraftSlot, quantity: number) => {
      dispatch({ type: 'UPDATE_QUANTITY', cardIdentifier, slot, quantity });
    },
    [],
  );

  const removeCard = useCallback((cardIdentifier: string, slot: TDraftSlot) => {
    dispatch({ type: 'REMOVE_CARD', cardIdentifier, slot });
  }, []);

  const removeIllegalCards = useCallback((illegalCardIds: ReadonlySet<string>) => {
    dispatch({ type: 'REMOVE_ILLEGAL', illegalCardIds });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET', initial });
  }, [initial]);

  const applyDraft = useCallback((payload: ICompositionDraft) => {
    dispatch({ type: 'APPLY_DRAFT', payload });
  }, []);

  const clearPersistedDraft = useCallback(() => {
    clearStoredDraft(deckId);
  }, [deckId]);

  const readPersistedDraft = useCallback((): TCompositionDraftPayload | null => {
    return readStoredDraft(deckId);
  }, [deckId]);

  return {
    draft,
    setHero,
    setFormat,
    addCard,
    updateQuantity,
    removeCard,
    removeIllegalCards,
    isDirty,
    changeCount,
    reset,
    applyDraft,
    clearPersistedDraft,
    readPersistedDraft,
  };
}
