import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TDeckStatus } from '../../../api/decks';
import { Deckbox, type IDeckboxCardSlot } from '../Deckbox';
import styles from '../Deckbox.module.css';
import medallionStyles from '../../readiness-medallion/ReadinessMedallion.module.css';

const linkSpy = vi.fn();

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>();
  return {
    ...actual,
    Link: (props: {
      children: React.ReactNode;
      to: string;
      params?: Record<string, string>;
      className?: string;
      onKeyDown?: React.KeyboardEventHandler<HTMLAnchorElement>;
      'aria-label'?: string;
      'data-testid'?: string;
      'data-variant'?: string;
    }) => {
      linkSpy(props);
      const { children, to, params, className, onKeyDown } = props;
      const href = params ? to.replace('$deckId', params.deckId ?? '') : to;
      return (
        <a
          href={href}
          className={className}
          onKeyDown={onKeyDown}
          aria-label={props['aria-label']}
          data-testid={props['data-testid']}
          data-variant={props['data-variant']}
        >
          {children}
        </a>
      );
    },
  };
});

const ART = { small: 'hero.jpg', smallSources: ['hero.jpg', 'hero-2.jpg'] };

function slot(id: string): IDeckboxCardSlot {
  return { cardIdentifier: id, imageUrl: { small: `${id}.jpg`, smallSources: [`${id}.jpg`] } };
}

function renderDeck(
  overrides: Partial<{
    status: TDeckStatus;
    cards: readonly (IDeckboxCardSlot | null)[];
    readinessPct: number | null;
  }> = {},
): void {
  render(
    <Deckbox
      variant="deck"
      deckId={42}
      deckName="Rhinar Aggro"
      format="Classic Constructed"
      status={overrides.status ?? 'building'}
      heroArt={ART}
      cards={overrides.cards ?? [slot('a'), slot('b'), slot('c')]}
      readinessPct={overrides.readinessPct === undefined ? 72 : overrides.readinessPct}
    />,
  );
}

function scenes(): HTMLElement[] {
  return Array.from(
    screen.getByTestId('deckbox').querySelectorAll<HTMLElement>('[data-scene-z]'),
  );
}

beforeEach(() => {
  linkSpy.mockClear();
});

describe('Deckbox (variant deck)', () => {
  it('BOX-01: renders three scenes in back, cards, front order', () => {
    renderDeck();
    expect(scenes().map((s) => s.dataset.sceneZ)).toEqual(['1', '2', '3']);
  });

  it('BOX-01: the three cards live inside the z=2 scene, and the front face inside z=3', () => {
    renderDeck();
    const [, cardsScene, frontScene] = scenes();
    expect(within(cardsScene as HTMLElement).getAllByTestId('deckbox-card')).toHaveLength(3);
    expect(screen.getAllByTestId('deckbox-card')).toHaveLength(3);
    expect(within(frontScene as HTMLElement).getByTestId('deckbox-front-deck')).toBeInTheDocument();
  });

  it('BOX-01: each scene carries its z-index class and wraps content in the shared box class', () => {
    renderDeck();
    const [back, cards, front] = scenes() as [HTMLElement, HTMLElement, HTMLElement];
    expect(back).toHaveClass(styles.scene as string, styles['scene--z1'] as string);
    expect(cards).toHaveClass(styles.scene as string, styles['scene--z2'] as string);
    expect(front).toHaveClass(styles.scene as string, styles['scene--z3'] as string);
    for (const scene of [back, cards, front]) {
      expect(scene.children).toHaveLength(1);
      expect(scene.children[0]).toHaveClass(styles.box as string);
    }
  });

  it('BOX-02: scenes carry the classes the hover rules key on', () => {
    renderDeck();
    const [back, cards, front] = scenes() as [HTMLElement, HTMLElement, HTMLElement];
    expect(back).toHaveClass(styles.backScene as string);
    expect(cards).toHaveClass(styles.cardsScene as string);
    expect(front).toHaveClass(styles.frontScene as string);
  });

  it('BOX-02: cards paint in c1, c3, c2 order and each carries its slot class', () => {
    renderDeck();
    const cards = screen.getAllByTestId('deckbox-card');
    const slotOf = (el: HTMLElement): string =>
      (['c1', 'c2', 'c3'] as const).find((c) => el.classList.contains(styles[c] as string)) ?? 'none';
    expect(cards.map(slotOf)).toEqual(['c1', 'c3', 'c2']);
    for (const card of cards) expect(card).toHaveClass(styles.card as string);
  });

  it('BOX-02: slot index 0, 1, 2 map to c1, c2, c3', () => {
    renderDeck({ cards: [slot('left'), slot('mid'), slot('right')] });
    const bySrc = (id: string): HTMLElement =>
      screen.getAllByTestId('deckbox-card').find((c) => c.querySelector(`img[src="${id}.jpg"]`)) as HTMLElement;
    expect(bySrc('left')).toHaveClass(styles.c1 as string);
    expect(bySrc('mid')).toHaveClass(styles.c2 as string);
    expect(bySrc('right')).toHaveClass(styles.c3 as string);
  });

  it('BOX-04: the front face carries the front class the status filters key on', () => {
    renderDeck({ status: 'retired' });
    expect(screen.getByTestId('deckbox-front-deck')).toHaveClass(styles.front as string);
  });

  it('BOX-07: the root link carries the deckbox and link classes', () => {
    renderDeck();
    expect(screen.getByTestId('deckbox')).toHaveClass(styles.deckbox as string, styles.link as string);
  });

  it('shows the deck name and format on the front face', () => {
    renderDeck();
    const front = screen.getByTestId('deckbox-front-deck');
    expect(within(front).getByText('Rhinar Aggro')).toBeInTheDocument();
    expect(within(front).getByText('Classic Constructed')).toBeInTheDocument();
  });

  it('BOX-03: an idea deck omits the cards scene entirely, even when cards are passed', () => {
    renderDeck({ status: 'idea' });
    expect(scenes().map((s) => s.dataset.sceneZ)).toEqual(['1', '3']);
    expect(screen.queryAllByTestId('deckbox-card')).toHaveLength(0);
  });

  it.each(['building', 'ready', 'active', 'retired'] as const)(
    'BOX-03: a %s deck renders the cards scene',
    (status) => {
      renderDeck({ status });
      expect(scenes()).toHaveLength(3);
    },
  );

  it.each(['idea', 'building', 'ready', 'active', 'retired'] as const)(
    'BOX-04: front face carries data-status=%s',
    (status) => {
      renderDeck({ status });
      expect(screen.getByTestId('deckbox-front-deck')).toHaveAttribute('data-status', status);
    },
  );

  it('pads missing card slots with placeholders so all three slots render', () => {
    renderDeck({ cards: [slot('a')] });
    const cards = screen.getAllByTestId('deckbox-card');
    expect(cards).toHaveLength(3);
    expect(cards.filter((c) => c.dataset.placeholder === 'true')).toHaveLength(2);
  });

  it('renders a placeholder for a card whose image sources all fail', () => {
    renderDeck({ cards: [slot('a'), slot('b'), slot('c')] });
    const [first] = screen.getAllByTestId('deckbox-card');
    const img = first?.querySelector('img') as HTMLImageElement;
    fireEvent.error(img);
    expect(first).toHaveAttribute('data-placeholder', 'true');
  });

  it('embeds the sm medallion when readiness is known', () => {
    renderDeck({ readinessPct: 72 });
    const meter = screen.getByTestId('readiness-medallion');
    expect(meter).toHaveAttribute('data-size', 'sm');
    expect(meter).toHaveAttribute('aria-valuenow', '72');
  });

  it('omits the medallion when readinessPct is null', () => {
    renderDeck({ readinessPct: null });
    expect(screen.queryByTestId('readiness-medallion')).toBeNull();
  });

  it('BOX-06: is a router Link to the deck, labelled with the deck name', () => {
    renderDeck();
    expect(linkSpy).toHaveBeenCalled();
    const props = linkSpy.mock.calls[0]?.[0];
    expect(props.to).toBe('/decks/$deckId');
    expect(props.params).toEqual({ deckId: '42' });
    expect(screen.getByTestId('deckbox')).toHaveAccessibleName('Abrir Rhinar Aggro');
  });

  it('BOX-06: Enter activates the link', () => {
    renderDeck();
    const link = screen.getByTestId('deckbox');
    const click = vi.spyOn(link, 'click').mockImplementation(() => undefined);
    fireEvent.keyDown(link, { key: 'Enter' });
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('BOX-06: Space activates the link and suppresses page scroll', () => {
    renderDeck();
    const link = screen.getByTestId('deckbox');
    const click = vi.spyOn(link, 'click').mockImplementation(() => undefined);
    const notPrevented = fireEvent.keyDown(link, { key: ' ' });
    expect(click).toHaveBeenCalledTimes(1);
    expect(notPrevented).toBe(false);
  });

  it('BOX-06: other keys do not activate the link', () => {
    renderDeck();
    const link = screen.getByTestId('deckbox');
    const click = vi.spyOn(link, 'click').mockImplementation(() => undefined);
    fireEvent.keyDown(link, { key: 'a' });
    expect(click).not.toHaveBeenCalled();
  });
});

describe('Deckbox medallion surface', () => {
  it('draws the readiness ring on a solid surface, never repeating the hero art the front face already shows', () => {
    renderDeck({ readinessPct: 72 });

    const medallion = screen.getByTestId('readiness-medallion');

    expect(medallion.querySelector('img')).toBeNull();
    expect(medallion.querySelector(`.${medallionStyles.artSolid}`)).not.toBeNull();
  });
});

describe('Deckbox open mouth', () => {
  it('renders the interior behind the cards and the rims on the front scene', () => {
    renderDeck();
    const scenes = document.querySelectorAll('[data-scene-z]');
    expect(scenes[0]?.querySelector(`.${styles.innerBack}`)).not.toBeNull();
    expect(scenes[0]?.querySelectorAll(`.${styles.rimBack}`)).toHaveLength(1);
    const front = scenes[scenes.length - 1];
    for (const cls of [styles.rimFront, styles.rimLeft, styles.rimRight]) {
      expect(front?.querySelectorAll(`.${cls}`)).toHaveLength(1);
    }
  });
});

describe('Deckbox (variant brand)', () => {
  function renderBrand(): void {
    render(<Deckbox variant="brand" />);
  }

  it('carries the brand modifier and never the interactive link class', () => {
    renderBrand();
    const root = screen.getByTestId('deckbox');
    expect(root).toHaveClass(styles.deckbox as string, styles['deckbox--brand'] as string);
    expect(root).not.toHaveClass(styles.link as string);
    expect(screen.getByTestId('deckbox-front-brand')).toHaveClass(styles.front as string);
  });

  it('is hidden from assistive technology', () => {
    renderBrand();
    expect(screen.getByTestId('deckbox')).toHaveAttribute('aria-hidden', 'true');
  });

  it('is not a router Link and has no tab stop', () => {
    renderBrand();
    expect(linkSpy).not.toHaveBeenCalled();
    const root = screen.getByTestId('deckbox');
    expect(root.tagName).not.toBe('A');
    expect(root.querySelectorAll('[tabindex]')).toHaveLength(0);
    expect(root).not.toHaveAttribute('tabindex');
  });

  it('renders no cards scene', () => {
    renderBrand();
    expect(scenes().map((s) => s.dataset.sceneZ)).toEqual(['1', '3']);
    expect(screen.queryAllByTestId('deckbox-card')).toHaveLength(0);
  });

  it('renders no medallion and no deck front face', () => {
    renderBrand();
    expect(screen.queryByTestId('readiness-medallion')).toBeNull();
    expect(screen.queryByTestId('deckbox-front-deck')).toBeNull();
  });

  it('renders the monogram on the brand front face', () => {
    renderBrand();
    expect(screen.getByTestId('deckbox-front-brand')).toBeInTheDocument();
    expect(screen.getByTestId('deckbox-monogram')).toHaveTextContent('R');
  });
});
