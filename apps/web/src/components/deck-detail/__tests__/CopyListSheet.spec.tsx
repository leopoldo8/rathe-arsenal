import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import i18n from '../../../i18n';
import { ToastProvider } from '../../ui/Toast/ToastProvider';
import { CopyListSheet } from '../CopyListSheet';
import { buildFabraryText, buildGroupText } from '../deckListText';
import {
  FIXTURE_CARDS,
  FIXTURE_DECK_NAME,
  FIXTURE_FORMAT,
  FIXTURE_ILLEGAL_LEGALITY,
  FIXTURE_LEGAL_LEGALITY,
} from './copyListFixture';

const writeText = vi.fn();

function renderSheet(legality = FIXTURE_LEGAL_LEGALITY) {
  return render(
    <ToastProvider>
      <CopyListSheet
        open
        onOpenChange={vi.fn()}
        deckName={FIXTURE_DECK_NAME}
        format={FIXTURE_FORMAT}
        cards={FIXTURE_CARDS}
        legality={legality}
      />
    </ToastProvider>,
  );
}

const input = { deckName: FIXTURE_DECK_NAME, format: FIXTURE_FORMAT, cards: FIXTURE_CARDS };
const groupText = (): string => buildGroupText(input, i18n.t.bind(i18n));

beforeEach(() => {
  writeText.mockReset();
  writeText.mockResolvedValue(undefined);
});

/** user-event installs its own clipboard when it is set up, so the spy goes in after it. */
function startUser() {
  const user = userEvent.setup();
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  return user;
}

describe('CopyListSheet', () => {
  it('two tabs, none chosen, full preview before copying', async () => {
    const user = startUser();
    renderSheet();

    const groupTab = screen.getByRole('tab', { name: 'Para o grupo' });
    const fabraryTab = screen.getByRole('tab', { name: 'Para Fabrary ou Talishar' });
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(groupTab).toHaveAttribute('aria-selected', 'false');
    expect(fabraryTab).toHaveAttribute('aria-selected', 'false');
    expect(screen.queryByTestId('copy-list-preview')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeDisabled();

    await user.click(groupTab);
    expect(groupTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('copy-list-preview').textContent).toBe(groupText());
    expect(screen.getByRole('button', { name: 'Copiar' })).toBeEnabled();

    await user.click(fabraryTab);
    expect(fabraryTab).toHaveAttribute('aria-selected', 'true');
    expect(groupTab).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByTestId('copy-list-preview').textContent).toBe(buildFabraryText(input));

    expect(document.body.textContent).not.toContain('GEM');
  });

  it('copy writes the previewed text', async () => {
    const user = startUser();
    renderSheet();

    await user.click(screen.getByRole('tab', { name: 'Para Fabrary ou Talishar' }));
    const previewed = screen.getByTestId('copy-list-preview').textContent;
    await user.click(screen.getByRole('button', { name: 'Copiar' }));

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(previewed);
    expect(await screen.findByText('Lista copiada')).toBeInTheDocument();
  });

  it('a rule warning does not block copying', async () => {
    const user = startUser();
    renderSheet(FIXTURE_ILLEGAL_LEGALITY as never);

    await user.click(screen.getByRole('tab', { name: 'Para o grupo' }));

    const warning = screen.getByText(
      'Esta lista não vale no Classic Constructed: Pack Hunt (Vermelho) aparece 4 vezes (3 no deck, 1 no inventário), o limite é 3. Dá para copiar mesmo assim.',
    );
    const preview = screen.getByTestId('copy-list-preview');
    expect(warning.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const copy = screen.getByRole('button', { name: 'Copiar' });
    expect(copy).toBeEnabled();
    await user.click(copy);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(groupText()));
  });

  it('says so when the clipboard refuses, and keeps the sheet open', async () => {
    const user = startUser();
    writeText.mockRejectedValue(new Error('denied'));
    renderSheet();

    await user.click(screen.getByRole('tab', { name: 'Para o grupo' }));
    await user.click(screen.getByRole('button', { name: 'Copiar' }));

    expect(await screen.findByText('Não deu para copiar. Selecione o texto e copie à mão.')).toBeInTheDocument();
    expect(screen.getByTestId('copy-list-preview')).toBeInTheDocument();
  });
});
