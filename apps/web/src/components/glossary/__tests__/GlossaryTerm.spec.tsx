import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { withLinkMock } from '../../../test/router-link-mock';

vi.mock('@tanstack/react-router', async (importOriginal) => withLinkMock(await importOriginal<object>()));

import { GlossaryScope } from '../GlossaryScope';
import { GlossaryTerm } from '../GlossaryTerm';

const PITCH_SENTENCE =
  'O número de 1 a 3 da carta, mostrado também pela cor: vermelha vale 1, amarela 2, azul 3. Para pagar o custo de uma carta, você descarta outras da mão, e cada uma paga o número do seu pitch.';

function setViewport(kind: 'phone' | 'computer'): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: kind === 'phone' && query.includes('max-width'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }),
  });
}

function renderPitch(own?: React.ComponentProps<typeof GlossaryTerm>['own']): void {
  render(
    <GlossaryScope>
      <p>
        <GlossaryTerm term="pitch" own={own} />
      </p>
    </GlossaryScope>,
  );
}

const DECK_PITCH = { kind: 'pitch', red: 14, yellow: 9, blue: 8 } as const;

describe('GlossaryTerm', () => {
  it('only the first appearance on a screen gets a question mark', () => {
    setViewport('phone');

    render(
      <GlossaryScope>
        <h2>
          <GlossaryTerm term="pitch" />
        </h2>
        <h2>
          <GlossaryTerm term="costCurve" />
        </h2>
        <p>
          <GlossaryTerm term="pitch" />
        </p>
      </GlossaryScope>,
    );

    expect(screen.getAllByRole('button', { name: 'O que é Pitch?' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'O que é Curva de custo?' })).toHaveLength(1);
    expect(screen.getAllByText('Pitch')).toHaveLength(2);
  });

  it('only the first appearance on a screen gets a question mark: the next one takes over when the first goes', () => {
    setViewport('phone');
    const tree = (withFirst: boolean): React.ReactElement => (
      <GlossaryScope>
        {withFirst && <GlossaryTerm term="pitch" />}
        <GlossaryTerm term="pitch" />
      </GlossaryScope>
    );

    const { rerender } = render(tree(true));
    expect(screen.getAllByRole('button', { name: 'O que é Pitch?' })).toHaveLength(1);

    rerender(tree(false));

    expect(screen.getAllByRole('button', { name: 'O que é Pitch?' })).toHaveLength(1);
  });

  it('draws a question mark in every appearance when there is no screen scope', () => {
    setViewport('phone');

    render(
      <>
        <GlossaryTerm term="pitch" />
        <GlossaryTerm term="pitch" />
      </>,
    );

    expect(screen.getAllByRole('button', { name: 'O que é Pitch?' })).toHaveLength(2);
  });

  it.each([
    ['a click', async () => userEvent.click(await screen.findByRole('button', { name: 'O que é Pitch?' }))],
    [
      'Enter',
      async () => {
        (await screen.findByRole('button', { name: 'O que é Pitch?' })).focus();
        await userEvent.keyboard('{Enter}');
      },
    ],
    [
      'Space',
      async () => {
        (await screen.findByRole('button', { name: 'O que é Pitch?' })).focus();
        await userEvent.keyboard(' ');
      },
    ],
  ])('opens by click, Enter and Space with the player\'s own line: a bottom sheet on a phone by %s', async (_how, open) => {
    setViewport('phone');
    renderPitch(DECK_PITCH);

    await open();

    const sheet = await screen.findByRole('dialog', { name: 'Pitch' });
    expect(sheet).toHaveAttribute('data-testid', 'glossary-sheet');
    expect(within(sheet).getByRole('heading', { name: 'Pitch' })).toBeInTheDocument();
    const texts = Array.from(sheet.querySelectorAll('p, a, button, h2')).map((node) => node.textContent);
    expect(texts).toEqual([
      'Pitch',
      PITCH_SENTENCE,
      'No seu deck: 14 vermelhas, 9 amarelas, 8 azuis.',
      'Ver todos os termos',
      'Fechar',
    ]);
    expect(within(sheet).getByRole('link', { name: 'Ver todos os termos' })).toHaveAttribute('href', '/termos');
  });

  it("opens by click, Enter and Space with the player's own line: a popover anchored to the word on a computer", async () => {
    setViewport('computer');
    renderPitch(DECK_PITCH);

    await userEvent.click(screen.getByRole('button', { name: 'O que é Pitch?' }));

    const popover = await screen.findByTestId('glossary-popover');
    expect(within(popover).getByRole('heading', { name: 'Pitch' })).toBeInTheDocument();
    expect(within(popover).getByTestId('glossary-own-line')).toHaveTextContent('No seu deck: 14 vermelhas, 9 amarelas, 8 azuis.');
    expect(within(popover).getByRole('link', { name: 'Ver todos os termos' })).toBeInTheDocument();
    expect(within(popover).getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
    expect(screen.queryByTestId('glossary-sheet')).toBeNull();
  });

  it('the own-data line follows the page: a retired deck, a shared format and no data at all', async () => {
    setViewport('phone');
    const { unmount } = render(
      <GlossaryScope>
        <GlossaryTerm term="retired" own={{ kind: 'stage', deckName: 'Rhinar Blitz v2', cards: 12 }} />
      </GlossaryScope>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'O que é Aposentado?' }));
    expect(await screen.findByTestId('glossary-own-line')).toHaveTextContent(
      'Seu deck Rhinar Blitz v2 continua salvo com as 12 cartas.',
    );
    unmount();

    const shared = render(
      <GlossaryScope>
        <GlossaryTerm term="classicConstructed" own={{ kind: 'format', sharerName: 'Pedro', format: 'Classic Constructed' }} />
      </GlossaryScope>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'O que é Classic Constructed?' }));
    expect(await screen.findByTestId('glossary-own-line')).toHaveTextContent('Este deck do Pedro é de Classic Constructed.');
    shared.unmount();

    render(
      <GlossaryScope>
        <GlossaryTerm term="pitch" />
      </GlossaryScope>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'O que é Pitch?' }));
    const sheet = await screen.findByTestId('glossary-sheet');
    expect(within(sheet).queryByTestId('glossary-own-line')).toBeNull();
    expect(sheet).toHaveTextContent(PITCH_SENTENCE);
  });

  it('the own-data line follows the page: a word the page has no data for gets the sentence alone', async () => {
    setViewport('phone');
    render(
      <GlossaryScope>
        <GlossaryTerm term="costCurve" own={DECK_PITCH} />
      </GlossaryScope>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'O que é Curva de custo?' }));

    expect(within(await screen.findByTestId('glossary-sheet')).queryByTestId('glossary-own-line')).toBeNull();
  });

  describe('focus returns to the question mark on every close', () => {
    async function openSheet(): Promise<HTMLElement> {
      setViewport('phone');
      renderPitch(DECK_PITCH);
      const question = screen.getByRole('button', { name: 'O que é Pitch?' });
      await userEvent.click(question);
      await screen.findByRole('dialog', { name: 'Pitch' });
      return question;
    }

    it('on Escape', async () => {
      const question = await openSheet();

      await userEvent.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(question).toHaveFocus();
    });

    it('on a tap outside', async () => {
      const question = await openSheet();

      await userEvent.click(document.querySelector('[data-state="open"][class*="overlay"]') as HTMLElement);

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(question).toHaveFocus();
    });

    it('on "Fechar"', async () => {
      const question = await openSheet();

      await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(question).toHaveFocus();
    });

    it('on Escape, in the popover of a computer', async () => {
      setViewport('computer');
      renderPitch(DECK_PITCH);
      const question = screen.getByRole('button', { name: 'O que é Pitch?' });
      await userEvent.click(question);
      await screen.findByTestId('glossary-popover');

      await userEvent.keyboard('{Escape}');

      await waitFor(() => expect(screen.queryByTestId('glossary-popover')).toBeNull());
      expect(question).toHaveFocus();
    });
  });
});
