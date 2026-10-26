import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api-client')>();
  const { mockApiFetch } = await import('../../chat/__tests__/chat-test-mocks');
  return { ...actual, useApiClient: () => mockApiFetch };
});
vi.mock('@tanstack/react-router', async () => (await import('../../chat/__tests__/chat-test-mocks')).routerMock);

import { callsTo, mockApiFetch, mockNavigate, navigatedTo, renderWithClient, serveApi } from '../../chat/__tests__/chat-test-utils';
import i18n from '../../../i18n';
import { buildRulesChecklist, type IRulesChecklist } from '../rulesChecklistModel';
import { RulesBar, RulesChecklistSheet } from '../RulesChecklistSheet';
import { focusCardRow } from '../focusCardRow';
import { blitzDraft, verdictOf } from './rulesChecklistTestData';
import type { ICompositionDraft } from '../../../hooks/useCompositionDraft';

const t = i18n.t.bind(i18n);

function checklistOf(draft: ICompositionDraft): IRulesChecklist {
  const checklist = buildRulesChecklist({ result: verdictOf(draft), draft, heroName: 'Rhinar', t });
  if (checklist === null) throw new Error('a Blitz draft has a checklist');
  return checklist;
}

function renderSheet(checklist: IRulesChecklist, handlers: { onClose?: () => void; onGoToCard?: (id: string) => void } = {}) {
  return render(
    <RulesChecklistSheet checklist={checklist} open onClose={handlers.onClose ?? vi.fn()} onGoToCard={handlers.onGoToCard ?? vi.fn()} />,
  );
}

/** The sheet of a deck whose owner has the Tutor: `tutorDeckId` is what the deck page passes with chat access. */
function renderSheetWithTutor(checklist: IRulesChecklist, tutorDeckId: number | null) {
  serveApi({
    'POST /chat/conversations': () => ({ id: 'c-1' }),
    'POST /chat/conversations/c-1/messages': () => ({ userMessageId: 'm-1', assistantMessageId: 'm-2' }),
    'GET /chat/conversations': () => [],
  });
  return renderWithClient(
    <RulesChecklistSheet checklist={checklist} open onClose={vi.fn()} onGoToCard={vi.fn()} {...(tutorDeckId === null ? {} : { tutorDeckId })} />,
  );
}

beforeEach(() => {
  mockApiFetch.mockReset();
  mockNavigate.mockReset();
});

describe('RulesBar', () => {
  it('the bar counts cards and rule problems', () => {
    const { rerender } = render(<RulesBar checklist={checklistOf(blitzDraft({ deckCards: 31, packHuntCopies: 2 }))} open={false} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: /31 de 40 cartas/ })).toHaveTextContent('31 de 40 cartas · 1 problema');

    rerender(<RulesBar checklist={checklistOf(blitzDraft({ deckCards: 32, packHuntCopies: 1 }))} open={false} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: /32 de 40 cartas/ })).toHaveTextContent('32 de 40 cartas · nenhum problema');
  });

  it('counts two rule problems in the plural', () => {
    render(<RulesBar checklist={checklistOf(blitzDraft({ deckCards: 31, packHuntCopies: 2, commandCopies: 2 }))} open={false} onToggle={vi.fn()} />);

    expect(screen.getByRole('button')).toHaveTextContent('31 de 40 cartas · 2 problemas');
  });

  it('opens the sheet on a tap and says whether it is open', async () => {
    const onToggle = vi.fn();
    render(<RulesBar checklist={checklistOf(blitzDraft({ deckCards: 31, packHuntCopies: 2 }))} open={false} onToggle={onToggle} />);

    const bar = screen.getByRole('button');
    expect(bar).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(bar);

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});

describe('RulesChecklistSheet', () => {
  it('matches r3-checklist-phone', () => {
    renderSheet(checklistOf(blitzDraft({ deckCards: 31, packHuntCopies: 2 })));

    const items = screen.getAllByRole('listitem').map((item) => ({ text: item.textContent, tone: item.getAttribute('data-tone') }));
    expect(items).toEqual([
      { text: 'Herói: Rhinar joga Blitz', tone: 'ok' },
      { text: 'Todas as cartas são permitidas no Blitz', tone: 'ok' },
      {
        text: 'Cartas que você leva: 35 de 52o deck, o inventário, a arma e os equipamentos; o herói não conta. No torneio isto se chama card pool.',
        tone: 'ok',
      },
      { text: 'Cópias: Pack Hunt (Vermelho) tem 2, o Blitz permite 1 · Ir para a carta', tone: 'problem' },
      { text: 'Tamanho: 31 de 40 cartas · coloque mais 9', tone: 'neutral' },
    ]);
    expect(screen.getByText('Para fechar: tire 1 Pack Hunt (Vermelho). O deck fica com 30, então coloque mais 10 cartas.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeInTheDocument();
  });

  it('every problem is listed at once', () => {
    renderSheet(checklistOf(blitzDraft({ deckCards: 31, packHuntCopies: 2, commandCopies: 2 })));

    const red = screen.getAllByRole('listitem').filter((item) => item.getAttribute('data-tone') === 'problem');
    expect(red.map((item) => item.textContent)).toEqual([
      'Cópias: Pack Hunt (Vermelho) tem 2, o Blitz permite 1 · Ir para a carta',
      'Cópias: Command and Conquer (Vermelho) tem 2, o Blitz permite 1 · Ir para a carta',
    ]);
    expect(screen.getByText(/^Para fechar: tire 1 Pack Hunt \(Vermelho\), tire 1 Command and Conquer \(Vermelho\)\./)).toBeInTheDocument();
  });

  it('go to the card focuses its row', async () => {
    const onClose = vi.fn();
    render(
      <>
        <ul>
          <li data-card-row="command-and-conquer-red" tabIndex={-1}>Command and Conquer</li>
          <li data-card-row="pack-hunt-red" tabIndex={-1}>Pack Hunt</li>
        </ul>
        <RulesChecklistSheet
          checklist={checklistOf(blitzDraft({ deckCards: 31, packHuntCopies: 2 }))}
          open
          onClose={onClose}
          onGoToCard={focusCardRow}
        />
      </>,
    );

    await userEvent.click(within(screen.getByTestId('rules-checklist-sheet')).getByRole('button', { name: 'Ir para a carta' }));

    expect(document.activeElement).toBe(document.querySelector('[data-card-row="pack-hunt-red"]'));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('rules-checklist-sheet')).toBeInTheDocument();
  });

  it('closes by its handle and by Fechar, and by nothing else', async () => {
    const onClose = vi.fn();
    renderSheet(checklistOf(blitzDraft({ deckCards: 31, packHuntCopies: 2 })), { onClose });

    await userEvent.keyboard('{Escape}');
    await userEvent.click(document.body);
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByTestId('rules-sheet-handle'));
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders nothing while closed', () => {
    render(<RulesChecklistSheet checklist={checklistOf(blitzDraft({ deckCards: 31, packHuntCopies: 2 }))} open={false} onClose={vi.fn()} onGoToCard={vi.fn()} />);

    expect(screen.queryByTestId('rules-checklist-sheet')).not.toBeInTheDocument();
  });

  it('each red line carries its Tutor question and the size line counts as Para fechar', () => {
    const checklist = checklistOf(blitzDraft({ deckCards: 31, packHuntCopies: 2 }));
    const view = renderSheetWithTutor(checklist, 7);

    const items = screen.getAllByRole('listitem');
    const copies = items.find((item) => item.getAttribute('data-tone') === 'problem')!;
    const size = items.find((item) => item.getAttribute('data-tone') === 'neutral')!;
    expect(within(copies).getByRole('button', { name: 'Perguntar ao Tutor o que pôr no lugar' })).toBeInTheDocument();
    const sizeButton = within(size).getByRole('button', { name: /^Perguntar ao Tutor quais \d+ cartas colocar$/ });
    expect(sizeButton).toHaveTextContent('Perguntar ao Tutor quais 10 cartas colocar');
    const closeSteps = screen.getByText(/^Para fechar:/).textContent ?? '';
    expect(/coloque mais (\d+) cartas/.exec(closeSteps)?.[1]).toBe('10');
    expect(items.filter((item) => item.getAttribute('data-tone') === 'ok').flatMap((item) => within(item).queryAllByText(/Perguntar ao Tutor/))).toEqual([]);
    view.unmount();

    renderSheetWithTutor(checklist, null);
    expect(screen.queryByText(/Perguntar ao Tutor/)).toBeNull();
  });

  it('a short deck with no rule problem asks only about the size', () => {
    renderSheetWithTutor(checklistOf(blitzDraft({ deckCards: 31, packHuntCopies: 1 })), 7);

    expect(screen.getAllByRole('button', { name: /Perguntar ao Tutor/ }).map((button) => button.textContent)).toEqual(['Perguntar ao Tutor quais 9 cartas colocar']);
  });

  it('a checklist question starts a bound conversation', async () => {
    const user = userEvent.setup();
    renderSheetWithTutor(checklistOf(blitzDraft({ deckCards: 31, packHuntCopies: 2 })), 7);

    await user.click(screen.getByRole('button', { name: 'Perguntar ao Tutor o que pôr no lugar' }));

    await waitFor(() => expect(navigatedTo()).toBe('/chat/c-1'));
    expect(callsTo('POST /chat/conversations')).toEqual([{ trackedDeckId: 7 }]);
    expect(callsTo('POST /chat/conversations/c-1/messages')).toEqual([{ text: 'Perguntar ao Tutor o que pôr no lugar' }]);
  });

  it('the checklist with Tutor questions follows a2-deck-ask-phone', () => {
    renderSheetWithTutor(checklistOf(blitzDraft({ deckCards: 31, packHuntCopies: 2 })), 7);

    const sheet = screen.getByTestId('rules-checklist-sheet');
    const items = within(sheet).getAllByRole('listitem').map((item) => item.textContent);
    expect(items[0]).toBe('Herói: Rhinar joga Blitz');
    expect(items[1]).toBe('Todas as cartas são permitidas no Blitz');
    expect(items[2]).toMatch(/^Cartas que você leva: 35 de 52/);
    expect(items[3]).toBe('Cópias: Pack Hunt (Vermelho) tem 2, o Blitz permite 1 · Ir para a cartaPerguntar ao Tutor o que pôr no lugar');
    expect(items[4]).toBe('Tamanho: 31 de 40 cartas · coloque mais 9Perguntar ao Tutor quais 10 cartas colocar');
    expect(items).toHaveLength(5);
    const goTo = within(sheet).getByRole('button', { name: 'Ir para a carta' });
    const ask = within(sheet).getByRole('button', { name: 'Perguntar ao Tutor o que pôr no lugar' });
    expect(goTo.compareDocumentPosition(ask) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const closeSteps = within(sheet).getByText('Para fechar: tire 1 Pack Hunt (Vermelho). O deck fica com 30, então coloque mais 10 cartas.');
    const lastItem = within(sheet).getAllByRole('listitem')[4]!;
    expect(lastItem.compareDocumentPosition(closeSteps) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const close = within(sheet).getByRole('button', { name: 'Fechar' });
    expect(closeSteps.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
