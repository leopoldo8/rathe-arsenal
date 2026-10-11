import { describe, it, expect } from 'vitest';
import { DEAL_TRANSFORM_ORIGIN, dealKeyframes } from '../recommendations/deal-geometry';

function translateY(transform: string): number {
  const match = /translate\([^,]+,\s*(-?[\d.]+)px\)/.exec(transform);
  if (!match) throw new Error(`no translate in ${transform}`);
  return Number(match[1]);
}

describe('deal geometry', () => {
  it('maps the pile box onto the slot box', () => {
    const frames = dealKeyframes({ left: 40, top: 300, width: 110 }, { left: 400, top: 260, width: 202 }, { left: 10, top: 100 });

    expect(frames[0]!.transform).toBe('translate(30px, 200px) scale(1) rotate(0deg)');
    expect(frames[frames.length - 1]!.transform).toBe('translate(390px, 160px) scale(1.8363636363636364) rotate(0deg)');
    expect(frames.map((keyframe) => keyframe.offset)).toEqual([0, 0.45, 1]);
    expect(translateY(frames[1]!.transform)).toBeLessThan(200);
    expect(translateY(frames[1]!.transform)).toBeLessThan(160);
    expect(DEAL_TRANSFORM_ORIGIN).toBe('0 0');
  });
});
