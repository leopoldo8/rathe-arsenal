import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { CARD_BACK_SRC } from './card-naming';
import { DEAL_FLIGHT_MS, DEAL_GAP_MS, DEAL_TRANSFORM_ORIGIN, dealKeyframes } from './deal-geometry';

const EASE = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const FLIP_EASE = 'cubic-bezier(0.45, 0, 0.25, 1)';
export const PILE_FOLD_DELAY_MS = 700;
export const PILE_FOLD_MS = 520;

export interface IDealCard {
  readonly id: string;
  readonly imageSrc: string | null;
}

export interface IDealClassNames {
  readonly flying: string;
  readonly flip: string;
  readonly face: string;
  readonly front: string;
  readonly shadow: string;
}

interface IUseDealOptions {
  readonly dealKey: string | null;
  readonly cards: readonly IDealCard[];
  readonly sectionRef: RefObject<HTMLElement | null>;
  readonly pileRef: RefObject<HTMLElement | null>;
  readonly classNames: IDealClassNames;
  readonly onDone: () => void;
}

export interface IDealState {
  readonly landed: ReadonlySet<string>;
  readonly folding: boolean;
}

function buildFlyingCard(card: IDealCard, width: number, classNames: IDealClassNames): HTMLDivElement {
  const flying = document.createElement('div');
  flying.className = classNames.flying;
  flying.setAttribute('data-testid', 'dealt-card');
  flying.setAttribute('data-card-id', card.id);
  flying.style.width = `${width}px`;
  flying.style.transformOrigin = DEAL_TRANSFORM_ORIGIN;
  const shadow = document.createElement('div');
  shadow.className = classNames.shadow;
  const flip = document.createElement('div');
  flip.className = classNames.flip;
  const back = document.createElement('img');
  back.className = classNames.face;
  back.src = CARD_BACK_SRC;
  back.alt = '';
  const front = document.createElement('img');
  front.className = `${classNames.face} ${classNames.front}`;
  front.src = card.imageSrc ?? CARD_BACK_SRC;
  front.alt = '';
  flip.append(back, front);
  flying.append(shadow, flip);
  return flying;
}

/**
 * Flies each card from the pile to its slot (`[data-deal-slot]` inside the section, in card order), marks it landed in
 * the same frame the flying copy is removed, then folds the pile away.
 */
export function useDeal({ dealKey, cards, sectionRef, pileRef, classNames, onDone }: IUseDealOptions): IDealState {
  const [landed, setLanded] = useState<ReadonlySet<string>>(new Set());
  const [folding, setFolding] = useState(false);

  useLayoutEffect(() => {
    if (dealKey === null) return undefined;
    setLanded(new Set());
    setFolding(false);
    const section = sectionRef.current;
    const pile = pileRef.current;
    const slots = section ? [...section.querySelectorAll<HTMLElement>('[data-deal-slot]')] : [];
    const timers: number[] = [];
    const fold = (): void => {
      timers.push(window.setTimeout(() => setFolding(true), PILE_FOLD_DELAY_MS));
      timers.push(window.setTimeout(onDone, PILE_FOLD_DELAY_MS + PILE_FOLD_MS));
    };

    if (!section || !pile || typeof pile.animate !== 'function' || slots.length !== cards.length) {
      setLanded(new Set(cards.map((card) => card.id)));
      fold();
      return () => timers.forEach((timer) => window.clearTimeout(timer));
    }

    const container = section.getBoundingClientRect();
    const from = pile.getBoundingClientRect();
    const flights = cards.map((card, index) => {
      const slot = slots[index]!.getBoundingClientRect();
      const flying = buildFlyingCard(card, from.width, classNames);
      section.appendChild(flying);
      const delay = index * DEAL_GAP_MS;
      const flight = flying.animate(dealKeyframes(from, slot, container).map((keyframe) => ({ ...keyframe })), { duration: DEAL_FLIGHT_MS, delay, easing: EASE, fill: 'both' });
      flying.querySelector(`.${classNames.flip.split(' ')[0]}`)?.animate(
        [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(180deg)' }],
        { duration: DEAL_FLIGHT_MS * 0.5, delay: delay + DEAL_FLIGHT_MS * 0.18, easing: FLIP_EASE, fill: 'both' },
      );
      flying.querySelector(`.${classNames.shadow.split(' ')[0]}`)?.animate(
        [{ opacity: 0.35 }, { opacity: 1, offset: 0.45 }, { opacity: 0 }],
        { duration: DEAL_FLIGHT_MS, delay, easing: EASE, fill: 'both' },
      );
      const finished = flight.finished
        .then(() => {
          flushSync(() => setLanded((current) => new Set([...current, card.id])));
          flying.remove();
        })
        .catch(() => flying.remove());
      return { flying, flight, finished };
    });
    let cancelled = false;
    void Promise.all(flights.map((entry) => entry.finished)).then(() => {
      if (!cancelled) fold();
    });

    return () => {
      cancelled = true;
      timers.forEach((timer) => window.clearTimeout(timer));
      flights.forEach(({ flying, flight }) => {
        flight.cancel();
        flying.remove();
      });
    };
    // Starts once per deal; the cards and refs of that render are the ones being dealt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealKey]);

  useEffect(() => {
    if (dealKey === null) {
      setLanded(new Set());
      setFolding(false);
    }
  }, [dealKey]);

  return { landed, folding };
}
