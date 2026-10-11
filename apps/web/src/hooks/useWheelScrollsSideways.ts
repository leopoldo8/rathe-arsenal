import { useEffect, useState } from 'react';

const LINE_HEIGHT_PX = 40;

function wheelDistancePx(event: WheelEvent, element: HTMLElement): number {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * LINE_HEIGHT_PX;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * element.clientWidth;
  return event.deltaY;
}

/**
 * A vertical mouse wheel over the element scrolls it sideways. A sideways gesture (trackpad), a pinch-zoom
 * (ctrl + wheel) or a wheel past either end is left alone, so the page scrolls as usual there.
 */
export function useWheelScrollsSideways<T extends HTMLElement>(): (element: T | null) => void {
  const [element, setElement] = useState<T | null>(null);

  useEffect(() => {
    if (element === null) return undefined;
    const onWheel = (event: WheelEvent): void => {
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const distance = wheelDistancePx(event, element);
      const furthest = element.scrollWidth - element.clientWidth;
      const canMove = distance > 0 ? element.scrollLeft < furthest - 1 : element.scrollLeft > 0;
      if (!canMove) return;
      event.preventDefault();
      element.scrollLeft = Math.min(furthest, Math.max(0, element.scrollLeft + distance));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [element]);

  return setElement;
}
