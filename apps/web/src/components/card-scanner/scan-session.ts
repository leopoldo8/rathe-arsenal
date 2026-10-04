import type { IResolvedCode, IScannedCard } from './collector-code';
import type { TVariantId } from './ocr-variants';

export const VOTE_WINDOW = 6;
export const REARM_AFTER_MISSES = 3;
export const MAX_TRAY_ROWS = 200;
export const MIN_ROW_QUANTITY = 1;
export const MAX_ROW_QUANTITY = 20;

export interface ITrayRow {
  readonly key: string;
  readonly candidates: readonly IScannedCard[];
  readonly picked: IScannedCard | null;
  readonly quantity: number;
}

interface IRecognitionVote {
  readonly variant: TVariantId;
  readonly code: string | null;
}

interface IHeldCode {
  readonly code: string;
  readonly misses: number;
}

export interface IScanSession {
  readonly rows: readonly ITrayRow[];
  readonly votes: readonly IRecognitionVote[];
  readonly held: IHeldCode | null;
}

export type TScanOutcome =
  | { readonly kind: 'added'; readonly rowKey: string; readonly code: string }
  | { readonly kind: 'tray-full' }
  | { readonly kind: 'none' };

export interface IScanStep {
  readonly session: IScanSession;
  readonly outcome: TScanOutcome;
}

export const EMPTY_SESSION: IScanSession = { rows: [], votes: [], held: null };

const NO_OUTCOME: TScanOutcome = { kind: 'none' };

export function applyRecognition(
  session: IScanSession,
  variant: TVariantId,
  resolved: IResolvedCode | null,
): IScanStep {
  const code = resolved?.code ?? null;
  const held = nextHeld(session.held, code);
  if (held !== null && code === held.code) {
    return { session: { ...session, held }, outcome: NO_OUTCOME };
  }

  const votes = [...session.votes, { variant, code }].slice(-VOTE_WINDOW);
  if (resolved === null || !hasAgreement(votes, resolved.code)) {
    return { session: { ...session, votes, held }, outcome: NO_OUTCOME };
  }

  const cleared = votes.filter((vote) => vote.code !== resolved.code);
  const step = addToTray({ ...session, votes: cleared, held }, resolved.cards, resolved.code);
  if (step.outcome.kind !== 'added') return step;
  return { ...step, session: { ...step.session, held: { code: resolved.code, misses: 0 } } };
}

function nextHeld(held: IHeldCode | null, code: string | null): IHeldCode | null {
  if (held === null) return null;
  if (code === held.code) return { code, misses: 0 };
  const misses = held.misses + 1;
  return misses >= REARM_AFTER_MISSES ? null : { code: held.code, misses };
}

function hasAgreement(votes: readonly IRecognitionVote[], code: string): boolean {
  return new Set(votes.filter((vote) => vote.code === code).map((vote) => vote.variant)).size >= 2;
}

export function addSearchedCard(session: IScanSession, card: IScannedCard): IScanStep {
  return addToTray(session, [card], card.cardIdentifier);
}

function addToTray(session: IScanSession, cards: readonly IScannedCard[], code: string): IScanStep {
  const key = cards.length === 1 ? cards[0]!.cardIdentifier : `code:${code}`;
  const existing = session.rows.find((row) => row.key === key);
  if (!existing && session.rows.length >= MAX_TRAY_ROWS) {
    return { session, outcome: { kind: 'tray-full' } };
  }
  const row: ITrayRow = existing
    ? { ...existing, quantity: Math.min(MAX_ROW_QUANTITY, existing.quantity + 1) }
    : { key, candidates: cards, picked: cards.length === 1 ? cards[0]! : null, quantity: 1 };
  const rows = [row, ...session.rows.filter((other) => other.key !== key)];
  return { session: { ...session, rows }, outcome: { kind: 'added', rowKey: key, code } };
}

export function undoScan(session: IScanSession, rowKey: string, code: string): IScanSession {
  const rows = session.rows
    .map((row) => (row.key === rowKey ? { ...row, quantity: row.quantity - 1 } : row))
    .filter((row) => row.quantity > 0);
  return { ...session, rows, held: { code, misses: 0 } };
}

export function setRowQuantity(session: IScanSession, rowKey: string, quantity: number): IScanSession {
  const clamped = Math.min(MAX_ROW_QUANTITY, Math.max(MIN_ROW_QUANTITY, quantity));
  return { ...session, rows: session.rows.map((row) => (row.key === rowKey ? { ...row, quantity: clamped } : row)) };
}

export function removeRow(session: IScanSession, rowKey: string): IScanSession {
  return { ...session, rows: session.rows.filter((row) => row.key !== rowKey) };
}

export function pickFace(session: IScanSession, rowKey: string, cardIdentifier: string): IScanSession {
  return {
    ...session,
    rows: session.rows.map((row) =>
      row.key === rowKey
        ? { ...row, picked: row.candidates.find((card) => card.cardIdentifier === cardIdentifier) ?? row.picked }
        : row,
    ),
  };
}

export function totalQuantity(session: IScanSession): number {
  return session.rows.reduce((sum, row) => sum + row.quantity, 0);
}

export function hasUnpickedRow(session: IScanSession): boolean {
  return session.rows.some((row) => row.picked === null);
}
