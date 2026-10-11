export interface IBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
}

export interface IDealKeyframe {
  readonly offset: number;
  readonly transform: string;
}

/** Scaling from the top-left corner is what lets the last translate land the card exactly on the slot. */
export const DEAL_TRANSFORM_ORIGIN = '0 0';
export const DEAL_FLIGHT_MS = 760;
export const DEAL_GAP_MS = 190;
const ARC_LIFT_PX = 46;
const ARC_PEAK_OFFSET = 0.45;

function frame(offset: number, x: number, y: number, scale: number, rotateDeg: number): IDealKeyframe {
  return { offset, transform: `translate(${x}px, ${y}px) scale(${scale}) rotate(${rotateDeg}deg)` };
}

/** Positions are relative to `container`, the element the flying card is appended to. */
export function dealKeyframes(pile: IBox, slot: IBox, container: Pick<IBox, 'left' | 'top'>): IDealKeyframe[] {
  const fromX = pile.left - container.left;
  const fromY = pile.top - container.top;
  const toX = slot.left - container.left;
  const toY = slot.top - container.top;
  const scale = slot.width / pile.width;
  return [
    frame(0, fromX, fromY, 1, 0),
    frame(ARC_PEAK_OFFSET, fromX + (toX - fromX) * ARC_PEAK_OFFSET, Math.min(fromY, toY) - ARC_LIFT_PX, ((1 + scale) / 2) * 1.04, -5),
    frame(1, toX, toY, scale, 0),
  ];
}
