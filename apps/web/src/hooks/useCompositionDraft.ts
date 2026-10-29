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
import type { ICardLegalityExtraFacts, ICardLegalityOverride } from '../api/card-legality-facts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TDraftSlot = 'mainboard' | 'hero' | 'weapon' | 'equipment' | 'other';

/** The two places a copy of a card sits: the starting deck or the inventory. */
export type TCopySide = 'deck' | 'inventory';

export interface IDraftCard extends ICardLegalityExtraFacts {
  readonly cardIdentifier: string;
  readonly name: string;
  /** Copies in the starting deck. */
  readonly quantity: number;
  /** Copies carried outside the starting deck (door 3); absent means none. A row may hold only these. */
  readonly inventoryQuantity?: number;
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
  readonly updateInventoryQuantity: (cardIdentifier: string, slot: TDraftSlot, quantity: number) => void;
  /** Moves `count` copies (at most what the source side holds) from one side of a row to the other. */
  readonly moveCopies: (cardIdentifier: string, slot: TDraftSlot, from: TCopySide, count: number) => void;
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
    readonly inventoryQuantity?: number;
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
    readonly restrictedFormats?: readonly string[];
    readonly legalOverrides?: readonly ICardLegalityOverride[];
    readonly specializations?: readonly string[];
    readonly legendary?: boolean;
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
  | { readonly type: 'UPDATE_INVENTORY'; readonly cardIdentifier: string; readonly slot: TDraftSlot; readonly quantity: number }
  | { readonly type: 'MOVE_COPIES'; readonly cardIdentifier: string; readonly slot: TDraftSlot; readonly from: TCopySide; readonly count: number }
  | { readonly type: 'REMOVE_CARD'; readonly cardIdentifier: string; readonly slot: TDraftSlot }
  | { readonly type: 'REMOVE_ILLEGAL'; readonly illegalCardIds: ReadonlySet<string> }
  | { readonly type: 'RESET' }
  | { readonly type: 'APPLY_DRAFT'; readonly payload: ICompositionDraft };

type TEditAction = Exclude<TDraftAction, { readonly type: 'RESET' | 'APPLY_DRAFT' }>;

/** Copies of a row carried outside the starting deck. */
export function inventoryOf(card: { readonly inventoryQuantity?: number }): number {
  return card.inventoryQuantity ?? 0;
}

/**
 * Applies `change` to the row of one card and slot; a row left with no copy on either side goes, a
 * row with only inventory copies stays.
 */
function withCopies(
  state: ICompositionDraft,
  target: { readonly cardIdentifier: string; readonly slot: TDraftSlot },
  change: (card: IDraftCard) => IDraftCard,
): ICompositionDraft {
  const cards = state.cards
    .map((card) => (card.cardIdentifier === target.cardIdentifier && card.slot === target.slot ? change(card) : card))
    .filter((card) => card.quantity + inventoryOf(card) > 0);
  return { ...state, cards };
}

function draftReducer(state: ICompositionDraft, action: TEditAction): ICompositionDraft {
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

    case 'UPDATE_QUANTITY':
      return withCopies(state, action, (card) => ({ ...card, quantity: Math.max(0, action.quantity) }));

    case 'UPDATE_INVENTORY':
      return withCopies(state, action, (card) => ({ ...card, inventoryQuantity: Math.max(0, action.quantity) }));

    case 'MOVE_COPIES':
      return withCopies(state, action, (card) => {
        const deck = card.quantity;
        const inventory = inventoryOf(card);
        const moved = Math.max(0, Math.min(action.count, action.from === 'deck' ? deck : inventory));
        return action.from === 'deck'
          ? { ...card, quantity: deck - moved, inventoryQuantity: inventory + moved }
          : { ...card, quantity: deck + moved, inventoryQuantity: inventory - moved };
      });

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

function extraFactsOf(card: ICardLegalityExtraFacts): ICardLegalityExtraFacts {
  return {
    ...(card.restrictedFormats === undefined ? {} : { restrictedFormats: card.restrictedFormats }),
    ...(card.legalOverrides === undefined ? {} : { legalOverrides: card.legalOverrides }),
    ...(card.specializations === undefined ? {} : { specializations: card.specializations }),
    ...(card.legendary === undefined ? {} : { legendary: card.legendary }),
  };
}

/**
 * One draft row per card and slot. A partly owned card arrives as two entries (the copies owned and
 * the copies missing), and the editor works on the card's total.
 */
function buildInitialDraft(payload: ICompositionDraftInitialPayload): ICompositionDraft {
  const rows = new Map<string, IDraftCard>();
  for (const c of payload.cards) {
    const slot = normaliseDraftSlot(c.slot);
    const key = `${c.cardIdentifier}::${slot}`;
    const existing = rows.get(key);
    const inventoryQuantity = c.inventoryQuantity ?? 0;
    if (c.quantity + inventoryQuantity <= 0) continue;
    rows.set(
      key,
      existing === undefined
        ? {
            cardIdentifier: c.cardIdentifier,
            name: c.name,
            quantity: c.quantity,
            inventoryQuantity,
            slot,
            pitch: c.pitch,
            cost: c.cost,
            type: c.type,
            imageUrl: c.imageUrl,
            legalFormats: c.legalFormats ?? [],
            legalHeroes: c.legalHeroes ?? [],
            bannedFormats: c.bannedFormats ?? [],
            ...extraFactsOf(c),
          }
        : {
            ...existing,
            quantity: existing.quantity + c.quantity,
            inventoryQuantity: inventoryOf(existing) + inventoryQuantity,
          },
    );
  }
  return {
    cards: [...rows.values()],
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
  const initialMap = new Map<TCardKey, string>();
  for (const c of initial.cards) {
    initialMap.set(`${c.cardIdentifier}::${c.slot}`, `${c.quantity}+${inventoryOf(c)}`);
  }
  const currentMap = new Map<TCardKey, string>();
  for (const c of current.cards) {
    currentMap.set(`${c.cardIdentifier}::${c.slot}`, `${c.quantity}+${inventoryOf(c)}`);
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
      inventoryQuantity: inventoryOf(c),
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

  // `null` until the player edits: the draft then is the server data itself, so new server data
  // replaces it and a refetch never looks like an unsaved change.
  const reducer = useCallback(
    (state: ICompositionDraft | null, action: TDraftAction): ICompositionDraft | null => {
      if (action.type === 'RESET') return null;
      if (action.type === 'APPLY_DRAFT') return action.payload;
      return draftReducer(state ?? initial, action);
    },
    [initial],
  );
  const [edited, dispatch] = useReducer(reducer, null);
  const draft = edited ?? initial;

  const isDirty = useMemo(() => edited !== null && isDraftDirty(initial, edited), [initial, edited]);
  const changeCount = useMemo(() => (edited === null ? 0 : computeChangeCount(initial, edited)), [initial, edited]);

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
      ...extraFactsOf(card),
    };
    dispatch({ type: 'ADD_CARD', card: draftCard });
  }, []);

  const updateQuantity = useCallback(
    (cardIdentifier: string, slot: TDraftSlot, quantity: number) => {
      dispatch({ type: 'UPDATE_QUANTITY', cardIdentifier, slot, quantity });
    },
    [],
  );

  const updateInventoryQuantity = useCallback(
    (cardIdentifier: string, slot: TDraftSlot, quantity: number) => {
      dispatch({ type: 'UPDATE_INVENTORY', cardIdentifier, slot, quantity });
    },
    [],
  );

  const moveCopies = useCallback((cardIdentifier: string, slot: TDraftSlot, from: TCopySide, count: number) => {
    dispatch({ type: 'MOVE_COPIES', cardIdentifier, slot, from, count });
  }, []);

  const removeCard = useCallback((cardIdentifier: string, slot: TDraftSlot) => {
    dispatch({ type: 'REMOVE_CARD', cardIdentifier, slot });
  }, []);

  const removeIllegalCards = useCallback((illegalCardIds: ReadonlySet<string>) => {
    dispatch({ type: 'REMOVE_ILLEGAL', illegalCardIds });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

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
    updateInventoryQuantity,
    moveCopies,
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
