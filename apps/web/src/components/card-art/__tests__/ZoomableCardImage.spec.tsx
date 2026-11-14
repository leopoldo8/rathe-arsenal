import React, { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ZoomableCardImage } from '../ZoomableCardImage';
import { imageFromSmall } from '../useCardLightbox';

const SMALL = 'https://cdn.example/cardfaces/small/WTR001.webp';

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
});

describe('imageFromSmall', () => {
  it('points the large image at the CDN large folder, keeping the small one as fallback', () => {
    // Arrange / Act
    const image = imageFromSmall(SMALL);

    // Assert
    expect(image.large).toBe('https://cdn.example/cardfaces/large/WTR001.webp');
    expect(image.sources?.map((source) => source.large)).toEqual([image.large, SMALL]);
  });

  it('uses the same URL when it is not a small CDN image', () => {
    expect(imageFromSmall('https://other.example/card.png')).toEqual({ small: 'https://other.example/card.png', large: 'https://other.example/card.png' });
  });
});

describe('ZoomableCardImage', () => {
  it('opens the card full screen on click and closes on Escape', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<ZoomableCardImage image={SMALL} name="Pummel (Vermelho)" />);

    // Act
    await user.click(screen.getByTestId('zoomable-card-image'));

    // Assert
    expect(screen.getByRole('dialog', { name: 'Pummel (Vermelho)' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('draws nothing without an image', () => {
    const { container } = render(<ZoomableCardImage image={null} name="Pummel" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('inside a modal dialog, Escape closes only the card and the dialog stays open', async () => {
    // Arrange
    const user = userEvent.setup();
    function Sheet(): React.ReactElement {
      const [open, setOpen] = useState(true);
      return (
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Portal>
            <Dialog.Content aria-describedby={undefined}>
              <Dialog.Title>Versões</Dialog.Title>
              <ZoomableCardImage image={SMALL} name="Pummel (Vermelho)" />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      );
    }
    render(<Sheet />);

    // Act
    await user.click(screen.getByTestId('zoomable-card-image'));
    const lightbox = screen.getByRole('dialog', { name: 'Pummel (Vermelho)' });

    // Assert: the card mounts inside the sheet, the only layer that takes clicks
    expect(screen.getByRole('dialog', { name: 'Versões' })).toContainElement(lightbox);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Pummel (Vermelho)' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Versões' })).toBeInTheDocument();
  });
});
