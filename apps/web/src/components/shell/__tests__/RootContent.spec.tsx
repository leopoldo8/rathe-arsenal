import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const route = vi.hoisted(() => ({ pathname: '/spare' }));

vi.mock('@tanstack/react-router', () => ({
  Outlet: () => <Page />,
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => unknown }) =>
    select({ location: { pathname: route.pathname } }),
}));
vi.mock('../TopBar', () => ({ TopBar: () => <header data-testid="top-bar" /> }));
vi.mock('../Footer', () => ({ Footer: () => <footer data-testid="footer" /> }));
vi.mock('../BottomTabBar', () => ({ BottomTabBar: () => <nav data-testid="tab-bar" /> }));

import { RootContent } from '../RootContent';

/** Stands in for a page that keeps what the visitor typed, like the quantities of /spare. */
function Page(): React.ReactElement {
  const [quantity, setQuantity] = useState('');
  return <input aria-label="quantity" value={quantity} onChange={(event) => setQuantity(event.currentTarget.value)} />;
}

let width = 1440;
const listeners = new Set<{ query: string; listener: () => void }>();

function matches(query: string): boolean {
  const min = /min-width: (\d+)px/.exec(query);
  if (min) return width >= Number(min[1]);
  const max = /max-width: (\d+)px/.exec(query);
  return max ? width <= Number(max[1]) : false;
}

function resizeTo(next: number): void {
  width = next;
  act(() => {
    for (const { listener } of listeners) listener();
  });
}

beforeEach(() => {
  route.pathname = '/spare';
  width = 1440;
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return matches(query);
    },
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add({ query, listener: () => listener({ matches: matches(query) } as MediaQueryListEvent) });
    },
    removeEventListener: () => undefined,
  }));
});

afterEach(() => {
  listeners.clear();
  vi.unstubAllGlobals();
});

describe('the shell around /spare and /library-pending', () => {
  it.each([720, 800, 959])('draws the top bar, the footer and the tab bar at %i px', (screenWidth) => {
    width = screenWidth;
    render(<RootContent />);

    expect(screen.getByTestId('top-bar')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
    expect(screen.getByTestId('tab-bar')).toBeInTheDocument();
  });

  it.each([360, 719])('keeps the page full screen with no shell at %i px', (screenWidth) => {
    width = screenWidth;
    render(<RootContent />);

    expect(screen.queryByTestId('top-bar')).toBeNull();
    expect(screen.queryByTestId('footer')).toBeNull();
    expect(screen.queryByTestId('tab-bar')).toBeNull();
    expect(screen.getByLabelText('quantity')).toBeInTheDocument();
  });

  it('draws the shell without a tab bar from 960 px', () => {
    width = 1200;
    render(<RootContent />);

    expect(screen.getByTestId('top-bar')).toBeInTheDocument();
    expect(screen.queryByTestId('tab-bar')).toBeNull();
  });

  it('does the same on /library-pending', () => {
    route.pathname = '/library-pending';
    width = 800;
    render(<RootContent />);

    expect(screen.getByTestId('tab-bar')).toBeInTheDocument();
  });
});

describe('the page keeps its state when the width crosses the shell breakpoint', () => {
  it('keeps what was typed when the window narrows to a phone and widens again', async () => {
    width = 1000;
    render(<RootContent />);
    await userEvent.type(screen.getByLabelText('quantity'), '3');

    resizeTo(500);
    expect(screen.queryByTestId('top-bar')).toBeNull();
    expect(screen.getByLabelText('quantity')).toHaveValue('3');

    resizeTo(1000);
    expect(screen.getByTestId('top-bar')).toBeInTheDocument();
    expect(screen.getByLabelText('quantity')).toHaveValue('3');
  });
});
