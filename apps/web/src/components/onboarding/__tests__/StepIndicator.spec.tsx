import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StepIndicator } from '../StepIndicator';
import styles from '../StepIndicator.module.css';

function renderAt(currentStep: 1 | 2 | 3, onStepClick?: (step: 1 | 2 | 3) => void) {
  return render(<StepIndicator totalSteps={3} currentStep={currentStep} onStepClick={onStepClick} />);
}

function stepItems(): HTMLElement[] {
  return screen.getAllByRole('listitem').filter((el) => el.hasAttribute('aria-label'));
}

describe('StepIndicator — three states (AUTH-02, half 1)', () => {
  it('renders exactly three step nodes', () => {
    renderAt(2);
    expect(stepItems()).toHaveLength(3);
  });

  it.each([
    [1, ['current', 'upcoming', 'upcoming']],
    [2, ['complete', 'current', 'upcoming']],
    [3, ['complete', 'complete', 'current']],
  ] as const)('at step %i the nodes carry the %j state classes', (step, states) => {
    renderAt(step);
    stepItems().forEach((li, i) => {
      const state = states[i] as string;
      expect(li).toHaveClass(styles[`step--${state}`] as string);
      expect(li.querySelector(`.${styles[`node--${state}`]}`)).not.toBeNull();
    });
  });

  it('marks only the current node with aria-current="step"', () => {
    renderAt(2);
    const current = stepItems().filter((li) => li.getAttribute('aria-current') === 'step');
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute('aria-label', expect.stringContaining('Passo 2 de 3'));
  });

  it('fills the connector only between completed nodes', () => {
    const { container } = renderAt(2);
    const connectors = container.querySelectorAll(`.${styles.connector}`);
    expect(connectors).toHaveLength(2);
    expect(connectors[0]).toHaveClass(styles['connector--passed'] as string);
    expect(connectors[1]).not.toHaveClass(styles['connector--passed'] as string);
  });
});

describe('StepIndicator — no roman numerals or diamonds (AUTH-02, half 2)', () => {
  it.each([1, 2, 3] as const)('renders no I/II/III text and no diamond markup at step %i', (step) => {
    const { container } = renderAt(step);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/\b(I|II|III)\b/);
    expect(text).not.toContain('◆');
    const classes = Array.from(container.querySelectorAll('[class]')).map((el) => el.getAttribute('class'));
    expect(classes.join(' ')).not.toMatch(/diamond|separator|numeral/i);
  });
});

describe('StepIndicator — activation (AUTH-03)', () => {
  it('makes completed nodes buttons that report their step', async () => {
    const onStepClick = vi.fn();
    renderAt(3, onStepClick);
    await userEvent.click(screen.getByRole('button', { name: /passo 1 de 3/i }));
    expect(onStepClick).toHaveBeenCalledTimes(1);
    expect(onStepClick).toHaveBeenCalledWith(1);
    await userEvent.click(screen.getByRole('button', { name: /passo 2 de 3/i }));
    expect(onStepClick).toHaveBeenLastCalledWith(2);
  });

  it('keeps the current and upcoming nodes out of the interaction model', () => {
    renderAt(2, vi.fn());
    expect(screen.getAllByRole('button')).toHaveLength(1);
    const upcoming = stepItems()[2] as HTMLElement;
    expect(upcoming.querySelector('[aria-disabled="true"]')).not.toBeNull();
    expect(stepItems()[1]?.querySelector('[aria-disabled]')).toBeNull();
  });

  it('renders no buttons when onStepClick is omitted', () => {
    renderAt(3);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
