import type { IResolvedCode, IScannedCard } from '../collector-code';
import type { TVariantId } from '../ocr-variants';
import {
  addSearchedCard,
  applyRecognition,
  EMPTY_SESSION,
  setRowQuantity,
  undoScan,
  type IScanSession,
} from '../scan-session';

function card(cardIdentifier: string): IScannedCard {
  return { cardIdentifier, name: cardIdentifier, pitch: 1, imageSmall: null };
}

function code(value: string, ...cardIds: string[]): IResolvedCode {
  return { code: value, cards: (cardIds.length > 0 ? cardIds : [`card-${value}`]).map(card) };
}

type TRead = readonly [TVariantId, IResolvedCode | null];

function run(reads: readonly TRead[], from: IScanSession = EMPTY_SESSION): IScanSession {
  return reads.reduce((session, [variant, resolved]) => applyRecognition(session, variant, resolved).session, from);
}

function quantities(session: IScanSession): Record<string, number> {
  return Object.fromEntries(session.rows.map((row) => [row.key, row.quantity]));
}

const A = code('AAA001');
const B = code('BBB001');

const ACCEPT_A: readonly TRead[] = [['full', A], ['left-binary', A]];
const THREE_MISSES: readonly TRead[] = [['full', null], ['left-binary', null], ['full-binary-sparse', null]];

describe('scan session', () => {
  describe('accepts a code when two different variants agree within six recognitions', () => {
    it('adds the card when two different variants agree', () => {
      expect(quantities(run(ACCEPT_A))).toEqual({ 'card-AAA001': 1 });
    });

    it('ignores the same variant agreeing with itself', () => {
      expect(run([['full', A], ['full', A], ['full', A]]).rows).toEqual([]);
    });

    function readsApart(distance: number): TRead[] {
      const gap = Array.from({ length: distance - 1 }, (): TRead => ['full-binary-sparse', null]);
      return [['full', A], ...gap, ['left-binary', A]];
    }

    it('accepts agreeing reads five recognitions apart, the edge of the window', () => {
      expect(quantities(run(readsApart(5)))).toEqual({ 'card-AAA001': 1 });
    });

    it('ignores agreeing reads six recognitions apart', () => {
      expect(run(readsApart(6)).rows).toEqual([]);
    });
  });

  it('adds one to an existing row', () => {
    const session = run([...ACCEPT_A, ...THREE_MISSES, ...ACCEPT_A]);

    expect(session.rows).toHaveLength(1);
    expect(quantities(session)).toEqual({ 'card-AAA001': 2 });
  });

  describe('does not count a card held in view twice', () => {
    it('holds while the code keeps being read', () => {
      const session = run([...ACCEPT_A, ['full-binary-sparse', A], ['full', A], ['left-binary', A]]);

      expect(quantities(session)).toEqual({ 'card-AAA001': 1 });
    });

    it('holds when one variant misses the code every third recognition', () => {
      const reads: TRead[] = [...ACCEPT_A];
      for (let round = 0; round < 4; round += 1) {
        reads.push(['full-binary-sparse', null], ['full', A], ['left-binary', A]);
      }

      expect(quantities(run(reads))).toEqual({ 'card-AAA001': 1 });
    });

    it('holds when one variant misreads the code every third recognition', () => {
      const reads: TRead[] = [...ACCEPT_A];
      for (let round = 0; round < 4; round += 1) {
        reads.push(['full-binary-sparse', B], ['full', A], ['left-binary', A]);
      }

      expect(quantities(run(reads))).toEqual({ 'card-AAA001': 1 });
    });

    it('still holds after only two recognitions without the code', () => {
      const session = run([...ACCEPT_A, ['full', null], ['left-binary', null], ...ACCEPT_A]);

      expect(quantities(session)).toEqual({ 'card-AAA001': 1 });
    });

    it('re-arms after three recognitions without the code', () => {
      const session = run([...ACCEPT_A, ...THREE_MISSES, ...ACCEPT_A]);

      expect(quantities(session)).toEqual({ 'card-AAA001': 2 });
    });
  });

  describe('undoes exactly one scan', () => {
    it('drops a row at 2 to 1', () => {
      const session = run([...ACCEPT_A, ...THREE_MISSES, ...ACCEPT_A]);

      expect(quantities(undoScan(session, 'card-AAA001', 'AAA001'))).toEqual({ 'card-AAA001': 1 });
    });

    it('removes a row at 1', () => {
      expect(undoScan(run(ACCEPT_A), 'card-AAA001', 'AAA001').rows).toEqual([]);
    });
  });

  describe('suppresses the rejected code until the card leaves', () => {
    it('adds nothing while the rejected code keeps being read, even with one variant missing', () => {
      const undone = undoScan(run(ACCEPT_A), 'card-AAA001', 'AAA001');
      const reads: TRead[] = [];
      for (let round = 0; round < 4; round += 1) {
        reads.push(['full-binary-sparse', null], ['full', A], ['left-binary', A]);
      }

      expect(run(reads, undone).rows).toEqual([]);
    });

    it('still suppresses after only two recognitions without it', () => {
      const undone = undoScan(run(ACCEPT_A), 'card-AAA001', 'AAA001');

      expect(run([['full', null], ['left-binary', null], ...ACCEPT_A], undone).rows).toEqual([]);
    });

    it('accepts the code again after three recognitions without it', () => {
      const undone = undoScan(run(ACCEPT_A), 'card-AAA001', 'AAA001');

      expect(quantities(run([...THREE_MISSES, ...ACCEPT_A], undone))).toEqual({ 'card-AAA001': 1 });
    });
  });

  it('adds a searched card like a scan', () => {
    const once = addSearchedCard(EMPTY_SESSION, card('picked'));
    const twice = addSearchedCard(once.session, card('picked'));

    expect(once.outcome).toMatchObject({ kind: 'added', rowKey: 'picked' });
    expect(quantities(twice.session)).toEqual({ picked: 2 });
  });

  it('clamps quantity between 1 and 20', () => {
    const session = run(ACCEPT_A);

    expect(quantities(setRowQuantity(session, 'card-AAA001', 0))).toEqual({ 'card-AAA001': 1 });
    expect(quantities(setRowQuantity(session, 'card-AAA001', 21))).toEqual({ 'card-AAA001': 20 });
  });

  it('orders by most recent scan', () => {
    const aThenB = run([...ACCEPT_A, ['full', B], ['left-binary', B]]);
    const aAgain = run([...THREE_MISSES, ...ACCEPT_A], aThenB);

    expect(aThenB.rows.map((row) => row.key)).toEqual(['card-BBB001', 'card-AAA001']);
    expect(aAgain.rows.map((row) => row.key)).toEqual(['card-AAA001', 'card-BBB001']);
  });

  describe('stops adding rows at 200', () => {
    const full = Array.from({ length: 200 }, (_, i) => card(`card-${i}`)).reduce(
      (session, next) => addSearchedCard(session, next).session,
      EMPTY_SESSION,
    );

    it('refuses a 201st card', () => {
      const step = addSearchedCard(full, card('one-too-many'));

      expect(step.outcome).toEqual({ kind: 'tray-full' });
      expect(step.session.rows).toHaveLength(200);
    });

    it('still adds one to a card already in the tray', () => {
      const step = addSearchedCard(full, card('card-7'));

      expect(step.outcome.kind).toBe('added');
      expect(quantities(step.session)['card-7']).toBe(2);
    });
  });
});
