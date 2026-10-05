import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import type { IDeckReplacement } from '../../../api/replacements';
import { setTestLocale } from '../../../test/i18n-test-utils';
import { breakdown, entry } from './deckDetailTestData';

vi.mock('@tanstack/react-router', () => ({
  Link: (props: { to: string; children: React.ReactNode }) => <a href={props.to}>{props.children}</a>,
}));

import { DeckActionPanels } from '../DeckActionPanels';

const replacement: IDeckReplacement = {
  id: 'replacement-1',
  slot: 'mainboard',
  originalCardIdentifier: 'emissary-of-tides-red',
  originalName: 'Emissary of Tides',
  replacementCardIdentifier: 'coax-a-commotion-red',
  quantity: 2,
  originalOwned: false,
};

describe('DeckActionPanels', () => {
  it('passes the active replacements to the missing panel and opens alternatives from it', async () => {
    await setTestLocale('en-US');
    const missing = entry({ cardIdentifier: 'coax-a-commotion-red', name: 'Coax a Commotion', quantity: 2 });
    const other = entry({ cardIdentifier: 'flex-red', name: 'Flex', quantity: 1 });
    const onOpenAlternatives = vi.fn();

    render(
      <DeckActionPanels
        breakdown={breakdown({ missing: [missing, other] })}
        deckSwaps={[]}
        openMissing={[missing, other]}
        shoppingData={null}
        onMarkOwned={vi.fn()}
        isMarkingOwned={false}
        pendingCard={null}
        pendingSwapId={null}
        onApproveSwap={vi.fn()}
        onRejectSwap={vi.fn()}
        onUndoSwap={vi.fn()}
        onFetchVariants={vi.fn()}
        fetchMutationStatus="idle"
        isCooldownActive={false}
        onPollingChange={vi.fn()}
        onShoppingRetry={vi.fn()}
        replacements={[replacement]}
        onOpenAlternatives={onOpenAlternatives}
      />,
    );

    const rows = screen.getAllByTestId('missing-row');
    const coax = rows.find((row) => row.textContent?.includes('Coax a Commotion'))!;
    const flex = rows.find((row) => row.textContent?.includes('Flex'))!;
    expect(within(coax).getByTestId('replacement-mark')).toHaveTextContent('in place of Emissary of Tides');
    expect(within(coax).queryByRole('button', { name: /alternatives/i })).toBeNull();
    expect(within(flex).queryByTestId('replacement-mark')).toBeNull();
    expect(within(flex).getByRole('button', { name: /alternatives/i })).toBeInTheDocument();
  });
});
