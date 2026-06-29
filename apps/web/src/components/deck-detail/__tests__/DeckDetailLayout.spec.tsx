/**
 * Unit tests for <DeckDetailLayout /> (U11)
 *
 * Test scenarios:
 *  - Happy path: renders header + sidebar + canvas slots at desktop width.
 *  - Happy path: all three regions receive their slot content.
 *  - Happy path: sidebar has the "Deck details" aria-label landmark.
 *  - Happy path: canvas is the main content area.
 *  - Happy path: below 1280px, sidebar becomes a card under the header
 *    (layout tested structurally; CSS-only collapse tested via SidebarCollapseToggle).
 *  - Layout: the page wrapper has the correct data-testid.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DeckDetailLayout } from '../DeckDetailLayout';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderLayout({
  header = <div data-testid="header-slot">Header</div>,
  sidebar = <div data-testid="sidebar-slot">Sidebar</div>,
  canvas = <div data-testid="canvas-slot">Canvas</div>,
} = {}) {
  return render(
    <DeckDetailLayout header={header} sidebar={sidebar} canvas={canvas} />,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DeckDetailLayout — structure', () => {
  it('renders all three slot regions', () => {
    renderLayout();
    expect(screen.getByTestId('header-slot')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-slot')).toBeInTheDocument();
    expect(screen.getByTestId('canvas-slot')).toBeInTheDocument();
  });

  it('has the deck-detail-layout data-testid wrapper', () => {
    renderLayout();
    expect(screen.getByTestId('deck-detail-layout')).toBeInTheDocument();
  });

  it('renders header inside a <header> element', () => {
    renderLayout();
    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();
    expect(header).toContainElement(screen.getByTestId('header-slot'));
  });

  it('renders sidebar inside an <aside> element with aria-label "Detalhes do baralho"', () => {
    renderLayout();
    const aside = screen.getByRole('complementary', { name: 'Detalhes do baralho' });
    expect(aside).toBeInTheDocument();
    expect(aside).toContainElement(screen.getByTestId('sidebar-slot'));
  });

  it('renders canvas inside a <main> element', () => {
    renderLayout();
    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toContainElement(screen.getByTestId('canvas-slot'));
  });
});

describe('DeckDetailLayout — slot content', () => {
  it('header slot renders arbitrary React nodes', () => {
    renderLayout({
      header: (
        <nav>
          <a href="/home">← Decks</a>
          <h1>My Deck</h1>
        </nav>
      ),
    });
    expect(screen.getByText('← Decks')).toBeInTheDocument();
    expect(screen.getByText('My Deck')).toBeInTheDocument();
  });

  it('sidebar slot renders arbitrary React nodes', () => {
    renderLayout({
      sidebar: (
        <div>
          <p>Hero Block</p>
          <p>Readiness Block</p>
        </div>
      ),
    });
    expect(screen.getByText('Hero Block')).toBeInTheDocument();
    expect(screen.getByText('Readiness Block')).toBeInTheDocument();
  });

  it('canvas slot renders arbitrary React nodes', () => {
    renderLayout({
      canvas: (
        <div>
          <section aria-label="Exact matches">Exact</section>
          <section aria-label="Swaps">Swaps</section>
          <section aria-label="Not owned">Not owned</section>
        </div>
      ),
    });
    expect(screen.getByText('Exact')).toBeInTheDocument();
    expect(screen.getByText('Swaps')).toBeInTheDocument();
    expect(screen.getByText('Not owned')).toBeInTheDocument();
  });
});

describe('DeckDetailLayout — mobile behavior', () => {
  it('sidebar renders in the document tree (CSS controls collapse below 1280px)', () => {
    // The layout always renders the sidebar in the DOM.
    // CSS toggles visibility below 1280px via DeckDetailSidebar's collapse logic.
    renderLayout({
      sidebar: <div data-testid="mobile-sidebar">Mobile sidebar content</div>,
    });
    // The sidebar element is in the DOM regardless of viewport width.
    expect(screen.getByTestId('mobile-sidebar')).toBeInTheDocument();
  });
});
