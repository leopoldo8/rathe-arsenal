import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Providers } from './spareKit';

const api = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('../../../lib/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/api-client')>()),
  useApiClient: () => api.fetch,
}));

import { SpareRuleSheet } from '../SpareRuleSheet';

const COUNTS = { within_format: 20, any_deck: 24, per_deck: 19 };

function renderSheet(props: Partial<React.ComponentProps<typeof SpareRuleSheet>> = {}): void {
  render(
    <Providers>
      <SpareRuleSheet counts={COUNTS} initialRule={null} backLabel="‹ Coleção" onBack={vi.fn()} {...props} />
    </Providers>,
  );
}

beforeEach(() => {
  api.fetch.mockReset();
});

describe('SpareRuleSheet', () => {
  it('asks the rule with each count, nothing selected, Continuar disabled until a pick', async () => {
    api.fetch.mockResolvedValue({ rule: 'any_deck' });
    const onSaved = vi.fn();
    renderSheet({ onSaved });

    const sheet = screen.getByTestId('spare-rule-sheet');
    const text = sheet.textContent ?? '';
    const inOrder = [
      '‹ Coleção',
      'Antes de contar o que sobra',
      'Você passa cartas de um deck para outro?',
      'Sim, entre decks do mesmo formato',
      'Ex.: o mesmo Snatch vai do Kayo CC para o Rhinar CC, mas não para o Silver Age',
      'Sobram 20 cópias',
      'Sim, entre quaisquer decks',
      'Ex.: o mesmo Snatch vai para qualquer deck',
      'Sobram 24 cópias',
      'Não, cada deck tem as próprias cartas',
      'Ex.: cada deck fica montado na caixa dele',
      'Sobram 19 cópias',
      'Dá para mudar depois em Por que sobra? e nas configurações.',
      'Continuar',
    ];
    const positions = inOrder.map((line) => text.indexOf(line));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
    for (const radio of radios) expect(radio).not.toBeChecked();
    const next = screen.getByRole('button', { name: 'Continuar' });
    expect(next).toBeDisabled();

    await userEvent.click(screen.getByRole('radio', { name: /Sim, entre quaisquer decks/ }));
    expect(next).toBeEnabled();
    await userEvent.click(next);

    await waitFor(() => expect(api.fetch).toHaveBeenCalledWith('/users/me/spare-rule', { method: 'PUT', body: JSON.stringify({ rule: 'any_deck' }) }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('any_deck'));
  });

  it('checks the stored rule when the player came to change it', () => {
    renderSheet({ initialRule: 'per_deck' });

    expect(screen.getByRole('radio', { name: /Não, cada deck tem as próprias cartas/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Sim, entre decks do mesmo formato/ })).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeEnabled();
  });

  it('keeps the sheet open and says so when the rule cannot be saved', async () => {
    api.fetch.mockRejectedValue(new Error('down'));
    const onSaved = vi.fn();
    renderSheet({ onSaved });

    await userEvent.click(screen.getByRole('radio', { name: /Sim, entre decks do mesmo formato/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar. Tente de novo.');
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('counts one copy in the singular', () => {
    renderSheet({ counts: { within_format: 1, any_deck: 1, per_deck: 0 } });

    expect(screen.getAllByText('Sobra 1 cópia')).toHaveLength(2);
    expect(screen.getByText('Sobram 0 cópias')).toBeInTheDocument();
  });
});
