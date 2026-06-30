/**
 * Tests for useFocusTrap (UXUI-03).
 *
 * Derives from spec.md UXUI-03 ACs and tasks.md T1 "Done when" criteria:
 *
 *  AC1 — Tab/Shift+Tab cycle only within the dialog (open state)
 *    - Forward Tab at last focusable → wraps to first
 *    - Backward Shift+Tab at first focusable → wraps to last
 *
 *  AC2 — Focus returns to opener element on close
 *    - Restore on deactivate (active: true → false)
 *
 *  T1 edge case — Hook is inactive: no interception
 *    - Tab fires without a registered handler; focus is unchanged
 */
import { describe, it, expect } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { useRef } from 'react';
import { useFocusTrap } from '../useFocusTrap';

// ---------------------------------------------------------------------------
// Fixture: opener button outside the container + 3 buttons inside the trap
// ---------------------------------------------------------------------------

function Fixture({ active }: { active: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(containerRef, active);
  return (
    <div>
      <button data-testid="opener">Opener</button>
      <div ref={containerRef} data-testid="container">
        <button data-testid="btn-a">A</button>
        <button data-testid="btn-b">B</button>
        <button data-testid="btn-c">C</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AC1: forward Tab cycle at last focusable element
// ---------------------------------------------------------------------------

describe('useFocusTrap — forward Tab cycle at last element (UXUI-03 AC1)', () => {
  it('wraps focus from last focusable to first on Tab', () => {
    const { getByTestId } = render(<Fixture active={true} />);
    const btnA = getByTestId('btn-a') as HTMLButtonElement;
    const btnC = getByTestId('btn-c') as HTMLButtonElement;

    // Manually focus the last element to simulate user tabbing through the trap
    act(() => {
      btnC.focus();
    });
    expect(document.activeElement).toBe(btnC);

    // Tab from the last element — must cycle to first (not escape the trap)
    fireEvent.keyDown(btnC, { key: 'Tab', shiftKey: false });

    expect(document.activeElement).toBe(btnA);
  });
});

// ---------------------------------------------------------------------------
// AC1: backward Shift+Tab cycle at first focusable element
// ---------------------------------------------------------------------------

describe('useFocusTrap — backward Shift+Tab cycle at first element (UXUI-03 AC1)', () => {
  it('wraps focus from first focusable to last on Shift+Tab', () => {
    const { getByTestId } = render(<Fixture active={true} />);
    const btnA = getByTestId('btn-a') as HTMLButtonElement;
    const btnC = getByTestId('btn-c') as HTMLButtonElement;

    // Manually focus the first element
    act(() => {
      btnA.focus();
    });
    expect(document.activeElement).toBe(btnA);

    // Shift+Tab from the first element — must cycle to last (not escape the trap)
    fireEvent.keyDown(btnA, { key: 'Tab', shiftKey: true });

    expect(document.activeElement).toBe(btnC);
  });
});

// ---------------------------------------------------------------------------
// AC2: focus restores to opener on deactivate
// ---------------------------------------------------------------------------

describe('useFocusTrap — restore focus to opener on deactivate (UXUI-03 AC2)', () => {
  it('returns focus to the element focused when trap activated', () => {
    const { getByTestId, rerender } = render(<Fixture active={false} />);
    const opener = getByTestId('opener') as HTMLButtonElement;

    // Opener receives focus BEFORE the trap activates (simulates: user focuses
    // a trigger button, then the dialog opens)
    act(() => {
      opener.focus();
    });
    expect(document.activeElement).toBe(opener);

    // Activate — hook records opener, shifts focus inside the trap
    rerender(<Fixture active={true} />);
    expect(document.activeElement).not.toBe(opener);

    // Deactivate — cleanup must restore focus to the recorded opener
    rerender(<Fixture active={false} />);
    expect(document.activeElement).toBe(opener);
  });
});

// ---------------------------------------------------------------------------
// T1 edge case: inactive no-op — Tab is not intercepted when active=false
// ---------------------------------------------------------------------------

describe('useFocusTrap — inactive no-op (T1 edge case)', () => {
  it('does not intercept Tab when the trap is inactive', () => {
    const { getByTestId } = render(<Fixture active={false} />);
    const btnA = getByTestId('btn-a') as HTMLButtonElement;

    act(() => {
      btnA.focus();
    });
    expect(document.activeElement).toBe(btnA);

    // No listener registered — jsdom does not implement Tab navigation,
    // so focus stays on btnA (unchanged), proving the hook did not intercept.
    fireEvent.keyDown(btnA, { key: 'Tab', shiftKey: false });

    expect(document.activeElement).toBe(btnA);
  });
});
