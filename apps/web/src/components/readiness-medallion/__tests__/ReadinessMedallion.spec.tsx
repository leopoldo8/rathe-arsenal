import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ReadinessMedallion, type TMedallionSize } from '../ReadinessMedallion';
import styles from '../ReadinessMedallion.module.css';

const ART = { small: 'a.jpg', smallSources: ['a.jpg', 'b.jpg'] };

function renderMedallion(
  pct: number,
  size: TMedallionSize = 'sm',
  heroArt: typeof ART | null = ART,
): HTMLElement {
  render(<ReadinessMedallion pct={pct} size={size} heroArt={heroArt} />);
  return screen.getByRole('meter');
}

describe('ReadinessMedallion', () => {
  describe.each(['sm', 'lg'] as const)('size %s', (size) => {
    it.each([
      [0, 'building'],
      [84, 'building'],
      [85, 'accent'],
      [99, 'accent'],
      [100, 'ready'],
    ])('pct %s carries data-band=%s', (pct, band) => {
      expect(renderMedallion(pct, size)).toHaveAttribute('data-band', band);
    });

    it('sets the ring sweep to the exact percentage', () => {
      renderMedallion(63.5, size);
      const ring = screen.getByRole('meter').querySelector<HTMLElement>('[style]');
      expect(ring?.style.getPropertyValue('--ra-medallion-pct')).toBe('63.5%');
    });

    it('exposes the rounded value as meter attributes and text', () => {
      const meter = renderMedallion(84.6, size);
      expect(meter).toHaveAttribute('aria-valuenow', '85');
      expect(meter).toHaveAttribute('aria-valuemin', '0');
      expect(meter).toHaveAttribute('aria-valuemax', '100');
      expect(meter).toHaveAttribute('aria-valuetext', '85%');
      expect(meter).toHaveAccessibleName('Prontidão do deck');
    });

    it('records the size', () => {
      expect(renderMedallion(50, size)).toHaveAttribute('data-size', size);
    });
  });

  it('clamps the sweep above 100 and below 0', () => {
    const { unmount } = render(
      <ReadinessMedallion pct={140} size="sm" heroArt={null} />,
    );
    expect(
      screen.getByRole('meter').querySelector<HTMLElement>('[style]')?.style.getPropertyValue('--ra-medallion-pct'),
    ).toBe('100%');
    unmount();
    render(<ReadinessMedallion pct={-5} size="sm" heroArt={null} />);
    expect(
      screen.getByRole('meter').querySelector<HTMLElement>('[style]')?.style.getPropertyValue('--ra-medallion-pct'),
    ).toBe('0%');
  });

  it('sm renders only the number: no percent glyph, no hero-name sublabel', () => {
    renderMedallion(72, 'sm');
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.queryByText('%')).toBeNull();
    expect(screen.queryByText('Rhinar')).toBeNull();
  });

  it('lg renders the percent glyph and nothing else under the number', () => {
    const meter = renderMedallion(72, 'lg');
    expect(screen.getByText('%')).toBeInTheDocument();
    expect(meter).toHaveTextContent(/^72%$/);
  });

  it('renders the hero art image when sources are available', () => {
    renderMedallion(50, 'sm');
    expect(screen.getByTestId('readiness-medallion-art')).toHaveAttribute('src', 'a.jpg');
    expect(screen.queryByTestId('readiness-medallion-art-fallback')).toBeNull();
  });

  it('falls back to the gradient when heroArt is null, keeping ring and number', () => {
    const meter = renderMedallion(90, 'sm', null);
    expect(screen.getByTestId('readiness-medallion-art-fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('readiness-medallion-art')).toBeNull();
    expect(meter).toHaveAttribute('data-band', 'accent');
    expect(screen.getByText('90')).toBeInTheDocument();
  });

  it('walks to the next source on error, then falls back once all have failed', () => {
    renderMedallion(50, 'sm');
    fireEvent.error(screen.getByTestId('readiness-medallion-art'));
    expect(screen.getByTestId('readiness-medallion-art')).toHaveAttribute('src', 'b.jpg');
    fireEvent.error(screen.getByTestId('readiness-medallion-art'));
    expect(screen.getByTestId('readiness-medallion-art-fallback')).toBeInTheDocument();
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '50');
  });

  it('carries the CSS classes the stylesheet keys on', () => {
    const meter = renderMedallion(50, 'lg');
    expect(meter).toHaveClass(styles.medallion as string);
    expect(meter.querySelector(`.${styles.ring}`)).toBeInTheDocument();
    expect(meter.querySelector(`.${styles.shade}`)).toBeInTheDocument();
    expect(screen.getByTestId('readiness-medallion-art')).toHaveClass(styles.art as string);
  });

  it('the ring element is the one that receives the sweep variable', () => {
    const meter = renderMedallion(40, 'sm');
    const ring = meter.querySelector<HTMLElement>(`.${styles.ring}`);
    expect(ring?.style.getPropertyValue('--ra-medallion-pct')).toBe('40%');
  });

  it('the fallback element carries the art and fallback classes', () => {
    renderMedallion(50, 'sm', null);
    const fallback = screen.getByTestId('readiness-medallion-art-fallback');
    expect(fallback).toHaveClass(styles.art as string);
    expect(fallback).toHaveClass(styles.artFallback as string);
  });

  it('merges a caller className onto the root', () => {
    render(<ReadinessMedallion pct={5} size="sm" heroArt={null} className="extra" />);
    const meter = screen.getByRole('meter');
    expect(meter).toHaveClass('extra');
    expect(meter).toHaveClass(styles.medallion as string);
  });

  describe('showArt=false', () => {
    function renderPlain(): HTMLElement {
      render(<ReadinessMedallion pct={64} size="lg" heroArt={ART} showArt={false} />);
      return screen.getByRole('meter');
    }

    it('draws a solid surface instead of the hero art', () => {
      renderPlain();
      expect(screen.queryByTestId('readiness-medallion-art')).not.toBeInTheDocument();
      expect(screen.queryByTestId('readiness-medallion-art-fallback')).not.toBeInTheDocument();
      const solid = screen.getByTestId('readiness-medallion-solid');
      expect(solid).toHaveClass(styles.art as string);
      expect(solid).toHaveClass(styles.artSolid as string);
    });

    it('drops the art shade but keeps the ring and number', () => {
      const meter = renderPlain();
      expect(meter.querySelector(`.${styles.shade}`)).not.toBeInTheDocument();
      expect(meter.querySelector(`.${styles.ring}`)).toBeInTheDocument();
      expect(meter).toHaveTextContent('64%');
    });

    it('defaults to drawing the art', () => {
      renderMedallion(64, 'lg');
      expect(screen.getByTestId('readiness-medallion-art')).toBeInTheDocument();
      expect(screen.queryByTestId('readiness-medallion-solid')).not.toBeInTheDocument();
    });
  });
});
