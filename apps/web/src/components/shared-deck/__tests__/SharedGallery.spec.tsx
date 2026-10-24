import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { SharedGallery, type TSharedGalleryCard } from '../SharedGallery';

function card(overrides: Partial<TSharedGalleryCard>): TSharedGalleryCard {
  return {
    cardIdentifier: 'pack-hunt-red',
    name: 'Pack Hunt',
    pitch: 1,
    type: 'Action',
    quantity: 2,
    imageUrl: null,
    ...overrides,
  };
}

describe('SharedGallery', () => {
  it('names the pitch', () => {
    render(
      <SharedGallery
        cards={[
          card({}),
          card({ cardIdentifier: 'pack-hunt-blue', pitch: 3 }),
          card({ cardIdentifier: 'dawnblade', name: 'Dawnblade', pitch: null, slot: 'weapon' }),
        ]}
        countAs="quantity"
        formatQuantity={(count) => `${count}×`}
      />,
    );

    const tiles = screen.getAllByTestId('shared-card');
    expect(within(tiles[0]!).getByRole('img', { name: 'Pack Hunt (Vermelho)' })).toBeInTheDocument();
    expect(within(tiles[1]!).getByRole('img', { name: 'Pack Hunt (Azul)' })).toBeInTheDocument();
    expect(within(tiles[2]!).getByRole('img', { name: 'Dawnblade' })).toBeInTheDocument();
    expect(within(tiles[0]!).getAllByText('Pack Hunt (Vermelho)').length).toBeGreaterThan(0);
  });
});
