import React from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ISharedDeckLegality } from '../../../api/shared-decks';
import { setTestLocale } from '../../../test/i18n-test-utils';
import { SharedLegalityBlock } from '../SharedLegalityBlock';

const PACK_HUNT = {
  code: 'too_many_copies',
  params: {
    card: 'Pack Hunt',
    cardIdentifier: 'pack-hunt-red',
    pitch: 1,
    count: 2,
    limit: 1,
    format: 'Blitz',
    legendary: false,
    restricted: false,
  },
};
const SIZE = { code: 'mainboard_not_exact', params: { card: null, count: 31, limit: 40, format: 'Blitz' } };

function heroNotLegal(format: string) {
  return {
    format,
    category: 'illegal' as const,
    details: [{ code: 'hero_not_legal', params: { hero: 'Rhinar', format, allowedFormats: ['Blitz', 'Silver Age'] } }],
  };
}

const SHARED_PHONE: ISharedDeckLegality = {
  category: 'illegal',
  heroYoung: true,
  details: [PACK_HUNT, SIZE],
  otherFormats: [heroNotLegal('Classic Constructed'), heroNotLegal('Living Legend'), { format: 'Silver Age', category: 'illegal', details: [PACK_HUNT] }],
};

const LEGAL_BLITZ: ISharedDeckLegality = { category: 'legal', heroYoung: true, details: [], otherFormats: SHARED_PHONE.otherFormats };

function renderBlock(legality: ISharedDeckLegality): void {
  render(<SharedLegalityBlock format="Blitz" legality={legality} />);
}

describe('SharedLegalityBlock', () => {
  beforeEach(async () => {
    await setTestLocale('pt-BR');
  });

  it('matches r3-shared-phone', () => {
    renderBlock(SHARED_PHONE);

    const lines = [
      'Blitz · ainda não pode jogar',
      'O deck tem 31 de 40 cartas.',
      'Pack Hunt (Vermelho) tem 2 cópias; o Blitz permite 1.',
      'Para jogar no Blitz: tirar 1 Pack Hunt (Vermelho) e colocar mais 10 cartas.',
      'Conferir em outro formato:',
      'Classic Constructed',
      'Living Legend',
      'Silver Age',
    ];
    const body = document.body.textContent ?? '';
    const positions = lines.map((line) => body.indexOf(line));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
    const chips = screen.getAllByRole('button');
    expect(chips.map((chip) => chip.textContent)).toEqual(['Classic Constructed', 'Living Legend', 'Silver Age']);
    expect(chips.every((chip) => chip.getAttribute('aria-pressed') === 'false')).toBe(true);
    expect(screen.queryByText(/Você tocou em/)).not.toBeInTheDocument();
  });

  it("another format's result never changes the own-format block", async () => {
    renderBlock(SHARED_PHONE);
    const block = screen.getByTestId('shared-own-format-verdict');
    const before = block.textContent;

    await userEvent.click(screen.getByRole('button', { name: 'Living Legend' }));

    expect(screen.getByText('Você tocou em Living Legend')).toBeInTheDocument();
    expect(screen.getByText('Em Living Legend: não vale. O Rhinar jovem joga só Blitz e Silver Age.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Living Legend' })).toHaveAttribute('aria-pressed', 'true');
    expect(block.textContent).toBe(before);
    expect(within(block).getByText('Blitz · ainda não pode jogar')).toBeInTheDocument();
  });

  it("another format's result never changes the own-format block, a legal deck included", async () => {
    renderBlock(LEGAL_BLITZ);

    expect(screen.getByText('Blitz · pode jogar')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Silver Age' }));

    expect(screen.getByText('Blitz · pode jogar')).toBeInTheDocument();
    expect(screen.getByText(/^Em Silver Age: não vale\./)).toBeInTheDocument();
  });

  it('tapping the pressed chip again clears its result', async () => {
    renderBlock(SHARED_PHONE);
    await userEvent.click(screen.getByRole('button', { name: 'Living Legend' }));

    await userEvent.click(screen.getByRole('button', { name: 'Living Legend' }));

    expect(screen.queryByText(/^Em Living Legend:/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Living Legend' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('says a format where the deck is valid is valid', async () => {
    renderBlock({
      ...SHARED_PHONE,
      otherFormats: [{ format: 'Silver Age', category: 'legal', details: [] }],
    });

    await userEvent.click(screen.getByRole('button', { name: 'Silver Age' }));

    expect(screen.getByText('Em Silver Age: vale.')).toBeInTheDocument();
  });

  it('shows no verdict for a format outside the four', () => {
    const { container } = render(
      <SharedLegalityBlock format="Open" legality={{ category: 'unchecked', heroYoung: null, details: [], otherFormats: [] }} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
