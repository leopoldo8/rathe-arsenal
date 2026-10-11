import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useWheelScrollsSideways } from '../useWheelScrollsSideways';

function Rail(): React.ReactElement {
  const ref = useWheelScrollsSideways<HTMLUListElement>();
  return <ul ref={ref} data-testid="rail" />;
}

function renderRail(scrollWidth: number, clientWidth: number): HTMLElement {
  render(<Rail />);
  const rail = screen.getByTestId('rail');
  Object.defineProperty(rail, 'scrollWidth', { configurable: true, value: scrollWidth });
  Object.defineProperty(rail, 'clientWidth', { configurable: true, value: clientWidth });
  return rail;
}

function wheel(target: HTMLElement, init: WheelEventInit): WheelEvent {
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

describe('useWheelScrollsSideways', () => {
  it('turns a vertical wheel into sideways scrolling until an end is reached', () => {
    const rail = renderRail(1000, 400);

    const down = wheel(rail, { deltaY: 100 });
    expect(down.defaultPrevented).toBe(true);
    expect(rail.scrollLeft).toBe(100);

    const lines = wheel(rail, { deltaY: 3, deltaMode: WheelEvent.DOM_DELTA_LINE });
    expect(lines.defaultPrevented).toBe(true);
    expect(rail.scrollLeft).toBe(220);

    wheel(rail, { deltaY: 1000 });
    expect(rail.scrollLeft).toBe(600);
    const pastEnd = wheel(rail, { deltaY: 100 });
    expect(pastEnd.defaultPrevented).toBe(false);
    expect(rail.scrollLeft).toBe(600);

    const up = wheel(rail, { deltaY: -250 });
    expect(up.defaultPrevented).toBe(true);
    expect(rail.scrollLeft).toBe(350);
  });

  it('leaves sideways gestures, pinch-zoom and the start edge to the browser', () => {
    const rail = renderRail(1000, 400);

    expect(wheel(rail, { deltaY: -100 }).defaultPrevented).toBe(false);
    expect(wheel(rail, { deltaX: 80, deltaY: 20 }).defaultPrevented).toBe(false);
    expect(wheel(rail, { deltaY: 100, ctrlKey: true }).defaultPrevented).toBe(false);
    expect(rail.scrollLeft).toBe(0);
  });

  it('does nothing when the content fits', () => {
    const rail = renderRail(400, 400);

    expect(wheel(rail, { deltaY: 100 }).defaultPrevented).toBe(false);
    expect(rail.scrollLeft).toBe(0);
  });
});
