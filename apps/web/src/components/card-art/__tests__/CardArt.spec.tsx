/**
 * CardArt component tests.
 *
 * Test plan (U13, lines 696–704 of the v1 foundation plan):
 *  1. Happy path — structural children (frame, cost diamond, pitch pip, name band, glyph).
 *  2. missing=true — hatch overlay element + reduced opacity class.
 *  3. Size presets — each renders the exact pixel width/height.
 *  4. pitch=null — colorless frame + no pitch pip.
 *  5. cost=null — no cost diamond.
 *  6. Unknown type — deckbox fallback glyph.
 *  7. Long name at xs — ellipsis CSS applied.
 *  8. A11y — role="img" + aria-label={name}.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardArt } from '../CardArt';

// ---------------------------------------------------------------------------
// SVG imports via vite-plugin-svgr are resolved in Vite. In jsdom/Vitest the
// ?react suffix is not handled by default. We stub ALL glyph SVG imports to
// return a minimal React component so the renderer does not throw.
// ---------------------------------------------------------------------------
vi.mock('../glyphs/attack.svg?react', () => ({
  default: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="glyph-attack" {...props} />
  ),
}));
vi.mock('../glyphs/defense.svg?react', () => ({
  default: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="glyph-defense" {...props} />
  ),
}));
vi.mock('../glyphs/instant.svg?react', () => ({
  default: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="glyph-instant" {...props} />
  ),
}));
vi.mock('../glyphs/equipment.svg?react', () => ({
  default: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="glyph-equipment" {...props} />
  ),
}));
vi.mock('../glyphs/ally.svg?react', () => ({
  default: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="glyph-ally" {...props} />
  ),
}));
vi.mock('../glyphs/weapon.svg?react', () => ({
  default: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="glyph-weapon" {...props} />
  ),
}));
vi.mock('../glyphs/hero.svg?react', () => ({
  default: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="glyph-hero" {...props} />
  ),
}));
vi.mock('../glyphs/deckbox.svg?react', () => ({
  default: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="glyph-deckbox" {...props} />
  ),
}));

// ---------------------------------------------------------------------------
// Shared fixture
// ---------------------------------------------------------------------------

const BASE_PROPS = {
  name: 'Sonata Arbalest',
  pitch: 2 as const,
  cost: 3,
  type: 'weapon',
  missing: false,
  size: 'md' as const,
};

// ---------------------------------------------------------------------------
// 1. Happy path — structural children
// ---------------------------------------------------------------------------
describe('CardArt — happy path structural children', () => {
  it('renders an SVG element with the card name in the name band', () => {
    // Arrange + Act
    render(<CardArt {...BASE_PROPS} />);

    // Assert — name band text
    expect(screen.getByText('Sonata Arbalest')).toBeInTheDocument();
  });

  it('renders the card frame rect', () => {
    // Arrange + Act
    const { container } = render(<CardArt {...BASE_PROPS} />);

    // Assert — frame has data-testid attribute
    const frame = container.querySelector('[data-testid="card-frame"]');
    expect(frame).not.toBeNull();
  });

  it('renders the cost diamond when cost is provided', () => {
    // Arrange + Act
    const { container } = render(<CardArt {...BASE_PROPS} />);

    // Assert
    const diamond = container.querySelector('[data-testid="cost-diamond"]');
    expect(diamond).not.toBeNull();
  });

  it('renders the pitch pip when pitch is provided', () => {
    // Arrange + Act
    const { container } = render(<CardArt {...BASE_PROPS} />);

    // Assert
    const pip = container.querySelector('[data-testid="pitch-pip"]');
    expect(pip).not.toBeNull();
  });

  it('renders the name band text element', () => {
    // Arrange + Act
    const { container } = render(<CardArt {...BASE_PROPS} />);

    // Assert
    const band = container.querySelector('[data-testid="name-band"]');
    expect(band).not.toBeNull();
  });

  it('renders the weapon glyph for type="weapon"', () => {
    // Arrange + Act
    render(<CardArt {...BASE_PROPS} type="weapon" />);

    // Assert — weapon glyph mock renders with data-testid
    expect(screen.getByTestId('glyph-weapon')).toBeInTheDocument();
  });

  it('does not render a missing overlay when missing=false', () => {
    // Arrange + Act
    const { container } = render(<CardArt {...BASE_PROPS} missing={false} />);

    // Assert
    const overlay = container.querySelector('[data-testid="missing-overlay"]');
    expect(overlay).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. missing=true — hatch overlay + reduced opacity class
// ---------------------------------------------------------------------------
describe('CardArt — missing state', () => {
  it('renders the hatch overlay element when missing=true', () => {
    // Arrange + Act
    const { container } = render(<CardArt {...BASE_PROPS} missing={true} />);

    // Assert
    const overlay = container.querySelector('[data-testid="missing-overlay"]');
    expect(overlay).not.toBeNull();
  });

  it('applies the missing CSS class to the container when missing=true', () => {
    // Arrange + Act
    const { container } = render(<CardArt {...BASE_PROPS} missing={true} />);

    // Assert — the container div should carry the missing variant class
    const wrapper = container.querySelector('[data-testid="card-art"]');
    expect(wrapper?.className).toContain('missing');
  });

  it('does NOT apply the missing class when missing=false', () => {
    // Arrange + Act
    const { container } = render(<CardArt {...BASE_PROPS} missing={false} />);

    // Assert
    const wrapper = container.querySelector('[data-testid="card-art"]');
    expect(wrapper?.className).not.toContain('missing');
  });

  it('renders the hatch <pattern> defs element when missing=true', () => {
    // Arrange + Act
    const { container } = render(<CardArt {...BASE_PROPS} missing={true} size="md" />);

    // Assert — pattern element is in the SVG defs. The id is generated via
    // React.useId() per instance to avoid DOM collisions when multiple
    // `missing` cards render simultaneously; we match on the stable prefix.
    const pattern = container.querySelector('pattern[id^="ra-hatch-"]');
    expect(pattern).not.toBeNull();
  });

  it('assigns unique pattern ids across multiple simultaneous instances', () => {
    // Regression guard for ce-review residual P2 — SVG `id` must be unique per DOM.
    const { container } = render(
      <>
        <CardArt {...BASE_PROPS} missing={true} size="md" />
        <CardArt {...BASE_PROPS} missing={true} size="md" />
        <CardArt {...BASE_PROPS} missing={true} size="md" />
      </>,
    );
    const patterns = container.querySelectorAll('pattern[id^="ra-hatch-"]');
    expect(patterns).toHaveLength(3);
    const ids = new Set(Array.from(patterns).map((p) => p.id));
    expect(ids.size).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// 3. Size presets — correct pixel dimensions
// ---------------------------------------------------------------------------
describe('CardArt — size dimensions', () => {
  it('renders width=40 height=57 for size="xs"', () => {
    // Arrange + Act
    const { container } = render(<CardArt {...BASE_PROPS} size="xs" />);

    // Assert — SVG attributes
    const svg = container.querySelector('svg[role="img"]');
    expect(svg).toHaveAttribute('width', '40');
    expect(svg).toHaveAttribute('height', '57'); // Math.round(40 * 10/7)
  });

  it('renders width=72 height=103 for size="sm"', () => {
    // Arrange + Act
    const { container } = render(<CardArt {...BASE_PROPS} size="sm" />);

    // Assert
    const svg = container.querySelector('svg[role="img"]');
    expect(svg).toHaveAttribute('width', '72');
    expect(svg).toHaveAttribute('height', '103'); // Math.round(72 * 10/7)
  });

  it('renders width=120 height=171 for size="md"', () => {
    // Arrange + Act
    const { container } = render(<CardArt {...BASE_PROPS} size="md" />);

    // Assert
    const svg = container.querySelector('svg[role="img"]');
    expect(svg).toHaveAttribute('width', '120');
    expect(svg).toHaveAttribute('height', '171'); // Math.round(120 * 10/7)
  });

  it('renders width=200 height=286 for size="lg"', () => {
    // Arrange + Act
    const { container } = render(<CardArt {...BASE_PROPS} size="lg" />);

    // Assert
    const svg = container.querySelector('svg[role="img"]');
    expect(svg).toHaveAttribute('width', '200');
    expect(svg).toHaveAttribute('height', '286'); // Math.round(200 * 10/7)
  });

  it('applies the size-specific CSS class to the container', () => {
    const sizes = ['xs', 'sm', 'md', 'lg'] as const;
    sizes.forEach((size) => {
      const { container } = render(<CardArt {...BASE_PROPS} size={size} />);
      const wrapper = container.querySelector('[data-testid="card-art"]');
      expect(wrapper?.className).toContain(size);
      // Cleanup is handled by afterEach in setup.ts
    });
  });
});

// ---------------------------------------------------------------------------
// 4. pitch=null — colorless frame + no pitch pip
// ---------------------------------------------------------------------------
describe('CardArt — pitch=null (colorless)', () => {
  it('renders no pitch pip when pitch=null', () => {
    // Arrange + Act
    const { container } = render(<CardArt {...BASE_PROPS} pitch={null} />);

    // Assert
    const pip = container.querySelector('[data-testid="pitch-pip"]');
    expect(pip).toBeNull();
  });

  it('still renders the card frame when pitch=null', () => {
    // Arrange + Act
    const { container } = render(<CardArt {...BASE_PROPS} pitch={null} />);

    // Assert — frame still present (colorless)
    const frame = container.querySelector('[data-testid="card-frame"]');
    expect(frame).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. cost=null — no cost diamond
// ---------------------------------------------------------------------------
describe('CardArt — cost=null', () => {
  it('renders no cost diamond when cost=null', () => {
    // Arrange + Act
    const { container } = render(<CardArt {...BASE_PROPS} cost={null} />);

    // Assert
    const diamond = container.querySelector('[data-testid="cost-diamond"]');
    expect(diamond).toBeNull();
  });

  it('still renders the card frame when cost=null', () => {
    // Arrange + Act
    const { container } = render(<CardArt {...BASE_PROPS} cost={null} />);

    // Assert
    const frame = container.querySelector('[data-testid="card-frame"]');
    expect(frame).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. Unknown type — deckbox fallback glyph
// ---------------------------------------------------------------------------
describe('CardArt — unknown type fallback', () => {
  it('renders the deckbox fallback glyph for type="foo"', () => {
    // Arrange + Act
    render(<CardArt {...BASE_PROPS} type="foo" />);

    // Assert — deckbox mock should be rendered, not any typed glyph
    expect(screen.getByTestId('glyph-deckbox')).toBeInTheDocument();
  });

  it('renders the deckbox fallback for an empty type string', () => {
    // Arrange + Act
    render(<CardArt {...BASE_PROPS} type="" />);

    // Assert
    expect(screen.getByTestId('glyph-deckbox')).toBeInTheDocument();
  });

  it('renders the deckbox fallback for type="UNKNOWN"', () => {
    // Arrange + Act
    render(<CardArt {...BASE_PROPS} type="UNKNOWN" />);

    // Assert
    expect(screen.getByTestId('glyph-deckbox')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 7. Long names at xs — ellipsis truncation via CSS
// ---------------------------------------------------------------------------
describe('CardArt — long name truncation', () => {
  it('applies the xs size class (which enables ellipsis CSS) for long names at xs', () => {
    // Arrange
    const longName = 'Phantasmal Footsteps of the Ethereal Wanderer';

    // Act
    const { container } = render(
      <CardArt {...BASE_PROPS} name={longName} size="xs" />,
    );

    // Assert — xs class is applied; CSS module defines text-overflow for xs
    const wrapper = container.querySelector('[data-testid="card-art"]');
    expect(wrapper?.className).toContain('xs');

    // The name text is still rendered in the DOM (truncation is visual/CSS)
    expect(screen.getByText(longName)).toBeInTheDocument();
  });

  it('renders the full long name in the name band text element regardless of size', () => {
    // Arrange — SVG text cannot truncate via CSS; name is always present in DOM
    const longName = 'This Is A Very Long Card Name Indeed';

    // Act
    render(<CardArt {...BASE_PROPS} name={longName} size="xs" />);

    // Assert — name present in DOM (visual truncation via SVG scaling / CSS)
    expect(screen.getByText(longName)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// 8. A11y — role="img" + aria-label
// ---------------------------------------------------------------------------
describe('CardArt — accessibility', () => {
  it('has role="img" on the root SVG element', () => {
    // Arrange + Act
    render(<CardArt {...BASE_PROPS} />);

    // Assert — getByRole finds the SVG
    const svg = screen.getByRole('img', { name: 'Sonata Arbalest' });
    expect(svg).toBeInTheDocument();
  });

  it('sets aria-label to the card name', () => {
    // Arrange + Act
    render(<CardArt {...BASE_PROPS} name="Awakening Bellow" />);

    // Assert
    const svg = screen.getByRole('img', { name: 'Awakening Bellow' });
    expect(svg).toHaveAttribute('aria-label', 'Awakening Bellow');
  });

  it('updates aria-label when name prop changes', () => {
    // Arrange
    const { rerender } = render(<CardArt {...BASE_PROPS} name="First Name" />);
    expect(screen.getByRole('img', { name: 'First Name' })).toBeInTheDocument();

    // Act
    rerender(<CardArt {...BASE_PROPS} name="Second Name" />);

    // Assert
    expect(screen.getByRole('img', { name: 'Second Name' })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Additional integration — all type glyphs resolve correctly
// ---------------------------------------------------------------------------
describe('CardArt — type glyph resolution', () => {
  const typeGlyphCases: Array<[string, string]> = [
    ['attack', 'glyph-attack'],
    ['attack-action', 'glyph-attack'],
    ['defense', 'glyph-defense'],
    ['defense-reaction', 'glyph-defense'],
    ['instant', 'glyph-instant'],
    ['equipment', 'glyph-equipment'],
    ['ally', 'glyph-ally'],
    ['weapon', 'glyph-weapon'],
    ['hero', 'glyph-hero'],
  ];

  typeGlyphCases.forEach(([cardType, expectedTestId]) => {
    it(`renders "${expectedTestId}" for type="${cardType}"`, () => {
      // Arrange + Act
      render(<CardArt {...BASE_PROPS} type={cardType} />);

      // Assert
      expect(screen.getByTestId(expectedTestId)).toBeInTheDocument();
    });
  });
});

// ---------------------------------------------------------------------------
// Button mode a11y (UXUI-13 AC4)
// ---------------------------------------------------------------------------
describe('CardArt — button mode ARIA (UXUI-13 AC4)', () => {
  it('wraps in a button when onClick is provided', () => {
    render(<CardArt {...BASE_PROPS} onClick={() => {}} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('inner svg has aria-hidden when onClick is provided', () => {
    const { container } = render(<CardArt {...BASE_PROPS} onClick={() => {}} />);
    // The main card SVG should be aria-hidden in button mode
    // (the button itself carries the accessible label)
    const hiddenSvgs = container.querySelectorAll('svg[aria-hidden="true"]');
    expect(hiddenSvgs.length).toBeGreaterThan(0);
  });

  it('svg does NOT have role="img" when onClick is provided', () => {
    render(<CardArt {...BASE_PROPS} onClick={() => {}} />);
    // In button mode, the svg should not act as an img
    expect(screen.queryByRole('img', { name: BASE_PROPS.name })).not.toBeInTheDocument();
  });

  it('svg has role="img" when onClick is NOT provided (default div mode)', () => {
    render(<CardArt {...BASE_PROPS} />);
    expect(screen.getByRole('img', { name: BASE_PROPS.name })).toBeInTheDocument();
  });
});
