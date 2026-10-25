import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
});
